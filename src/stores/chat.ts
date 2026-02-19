// ---------------------------------------------------------------------------
// Chat Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Unsubscribe } from '@/gateway/types';
import { useConnectionStore } from './connection';
import { useSessionsStore } from './sessions';

// ---- Message Types --------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageContent {
  type: 'text' | 'image' | 'file' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  name?: string;
  url?: string;
  mimeType?: string;
  toolUseId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  timestamp: number;
  model?: string;
  tokenCount?: {
    input?: number;
    output?: number;
  };
  metadata?: Record<string, unknown>;
}

// ---- Attachment Types -----------------------------------------------------

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
  url?: string;
}

// ---- Gateway Attachment Block Types ---------------------------------------
// The gateway `chat.send` `attachments` field accepts TArray<TUnknown>.
// We send content blocks in Anthropic-compatible format; the gateway routes
// these to the appropriate provider representation server-side.

interface GatewayImageAttachment {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface GatewayFileAttachment {
  type: 'document';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  title?: string;
}

type GatewayAttachment = GatewayImageAttachment | GatewayFileAttachment;

/**
 * Convert a UI Attachment to the gateway-compatible attachment block.
 * Uses Anthropic content-block format since that is what the gateway
 * forwards to the underlying provider.
 */
function toGatewayAttachment(att: Attachment): GatewayAttachment {
  if (att.type.startsWith('image/')) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: att.type,
        data: att.data,
      },
    };
  }
  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: att.type || 'application/octet-stream',
      data: att.data,
    },
    title: att.name,
  };
}

// ---- Session Config Types -------------------------------------------------

export interface SessionConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinkingLevel?: 'none' | 'low' | 'medium' | 'high';
  systemPrompt?: string;
}

// ---- Chat Event Payload ---------------------------------------------------
// Canonical gateway schema from ChatEventSchema in docs/protocol/schema/logs-chat.d.ts
// Also covers legacy schema: {delta, done, error, seq, messageId}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  // Alternate schema (state-based)
  state?: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
  // Legacy schema fields
  delta?: string;
  done?: boolean;
  error?: { message: string } | string;
  // Present on some schemas
  messageId?: string;
}

// ---- Store Types ----------------------------------------------------------

interface ChatState {
  // -- Messages
  messages: Message[];

  // -- Active session
  activeSessionKey: string | null;

  // -- Streaming state
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingBuffer: string;
  lastSeq: number;

  // -- Attachments
  attachments: Attachment[];

  // -- Session config
  sessionConfig: SessionConfig;

  // -- Error state
  error: string | null;

  // -- Event subscription
  eventUnsubscribe: Unsubscribe | null;
  _streamWatchdog: ReturnType<typeof setTimeout> | null;
  _pollFallback: ReturnType<typeof setTimeout> | null;
  _activeRunId: string | null;

  // -- Actions
  setActiveSession: (sessionKey: string) => void;
  loadHistory: (sessionKey: string) => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  abortStream: () => Promise<void>;
  injectNote: (text: string) => Promise<void>;
  addAttachment: (attachment: Attachment) => void;
  addMultipleAttachments: (files: File[]) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
  updateSessionConfig: (config: Partial<SessionConfig>) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Helpers --------------------------------------------------------------

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function extractTextFromEventMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    const parts = message
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const block = item as Record<string, unknown>;
        // text block
        if (block.type === 'text' && typeof block.text === 'string') return block.text;
        // thinking block — extract thought text
        if (block.type === 'thinking' && typeof block.thinking === 'string') return block.thinking;
        if (block.type === 'thinking' && typeof block.text === 'string') return block.text;
        // tool_use block — stringify input for text extraction purposes
        if (block.type === 'tool_use') {
          const name = typeof block.name === 'string' ? block.name : 'tool';
          const input = block.input !== undefined ? JSON.stringify(block.input) : '';
          return `[Tool: ${name}] ${input}`;
        }
        // tool_result block — extract content
        if (block.type === 'tool_result') {
          if (typeof block.content === 'string') return block.content;
          if (Array.isArray(block.content)) return extractTextFromEventMessage(block.content);
          return '';
        }
        // Generic fallback: text field present
        if (typeof block.text === 'string') return block.text;
        return '';
      })
      .filter(Boolean);
    return parts.join('\n');
  }
  if (message && typeof message === 'object') {
    const block = message as Record<string, unknown>;
    if (typeof block.text === 'string') return block.text;
    if (block.type === 'thinking' && typeof block.thinking === 'string') return block.thinking;
    if (block.type === 'tool_use') {
      const name = typeof block.name === 'string' ? block.name : 'tool';
      const input = block.input !== undefined ? JSON.stringify(block.input) : '';
      return `[Tool: ${name}] ${input}`;
    }
    if (block.type === 'tool_result') {
      if (typeof block.content === 'string') return block.content;
      if (Array.isArray(block.content)) return extractTextFromEventMessage(block.content);
      return '';
    }
  }
  return '';
}

// ---- History Normalizer (CI-1) --------------------------------------------
// Defensive normalizer for raw gateway history entries.
// Gateway may return content as a string, array of content blocks, or an object.
// Skips entries that are malformed (not objects, missing role).

function normalizeContentBlock(raw: unknown): MessageContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const block = raw as Record<string, unknown>;
  const type = block.type;

  if (type === 'text') {
    return { type: 'text', text: typeof block.text === 'string' ? block.text : '' };
  }
  if (type === 'image') {
    return {
      type: 'image',
      url: typeof block.url === 'string' ? block.url : undefined,
      mimeType: typeof block.mimeType === 'string' ? block.mimeType : undefined,
    };
  }
  if (type === 'file') {
    return {
      type: 'file',
      name: typeof block.name === 'string' ? block.name : undefined,
      url: typeof block.url === 'string' ? block.url : undefined,
      mimeType: typeof block.mimeType === 'string' ? block.mimeType : undefined,
    };
  }
  if (type === 'tool_use') {
    return {
      type: 'tool_use',
      toolUseId: typeof block.id === 'string' ? block.id : undefined,
      toolName: typeof block.name === 'string' ? block.name : undefined,
      input: block.input,
    };
  }
  if (type === 'tool_result') {
    return {
      type: 'tool_result',
      toolUseId: typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined,
      output: block.content,
      isError: block.is_error === true,
    };
  }
  if (type === 'thinking') {
    const thought =
      typeof block.thinking === 'string'
        ? block.thinking
        : typeof block.text === 'string'
          ? block.text
          : '';
    return { type: 'thinking', text: thought };
  }
  // Unknown block type with a text field — treat as text
  if (typeof block.text === 'string') {
    return { type: 'text', text: block.text };
  }
  return null;
}

/**
 * Strip gateway-injected metadata from message text content.
 * The gateway prepends context like channel status, conversation info,
 * and system timestamps to user messages. These are useful for the AI
 * but shouldn't be shown in the chat UI.
 */
export function stripGatewayMetadata(text: string): string {
  let cleaned = text;
  // Remove "System: [timestamp] channel connected/disconnected" lines
  cleaned = cleaned.replace(
    /^System:\s*\[[\d\- :A-Z]+\]\s+\S+\s+(gateway\s+)?(connected|disconnected).*\n?/gim,
    ''
  );
  // Remove "Conversation info (untrusted metadata):" + JSON block
  // Handles: optional language-tagged fences (```json), inline JSON, "Copy" artifacts
  cleaned = cleaned.replace(
    /^Conversation info\s*\(untrusted metadata\):\s*\n?(?:```(?:\w+)?\n?)?(?:Copy\n?)?\{[^}]*\}\n?(?:```\n?)?/gim,
    ''
  );
  // Fallback: strip from "Conversation info" down to the next blank line if fence parsing fails
  cleaned = cleaned.replace(
    /^Conversation info\s*\(untrusted metadata\):\s*\n[\s\S]*?(?=\n\s*\n|$)/gim,
    ''
  );
  // Remove gateway-injected timestamp prefixes: [Wed 2026-02-18 11:04 CST]
  cleaned = cleaned.replace(
    /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[A-Z]{2,5}\]\s*/gim,
    ''
  );
  // Remove "System:" prefix lines with timestamps (various formats)
  cleaned = cleaned.replace(/^System:\s*\[\d{4}-\d{2}-\d{2}[^\]]*\].*\n?/gim, '');
  // Remove [[reply_to_current]] markers
  cleaned = cleaned.replace(/\[\[reply_to_current\]\]/gi, '');
  // Remove "[Chat messages since your last reply - for context]" wrappers
  cleaned = cleaned.replace(
    /^\[(?:Chat messages since your last reply|Current message)\s*[-\u2013\u2014]\s*[^\]]*\]\s*\n?/gim,
    ''
  );
  // Remove leading/trailing whitespace
  return cleaned.trim();
}

// ---- Sentinel Token Filtering ---------------------------------------------
// OpenClaw uses internal sentinel tokens (NO_REPLY for memory flush,
// HEARTBEAT_OK for heartbeat ack) that should never appear in the UI.

const SILENT_REPLY_TOKENS = new Set(['NO_REPLY', 'HEARTBEAT_OK']);

export function isSilentReplyMessage(msg: Message): boolean {
  if (msg.role !== 'assistant') return false;
  const text = msg.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim();
  const stripped = text.replace(/[.\s!?]+$/g, '').trim();
  return SILENT_REPLY_TOKENS.has(stripped) || SILENT_REPLY_TOKENS.has(stripped.toUpperCase());
}

export function isInternalSystemMessage(msg: Message): boolean {
  if (msg.role !== 'system') return false;
  const text = msg.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
  return (
    text.includes('Session nearing compaction') ||
    text.includes('reply with NO_REPLY') ||
    text.includes('HEARTBEAT_OK')
  );
}

function normalizeContentToBlocks(content: unknown): MessageContent[] {
  // Already a string — wrap as single text block (strip metadata)
  if (typeof content === 'string') {
    const cleaned = stripGatewayMetadata(content);
    return cleaned ? [{ type: 'text', text: cleaned }] : [];
  }
  // Array of content blocks
  if (Array.isArray(content)) {
    const blocks: MessageContent[] = [];
    for (const item of content) {
      if (typeof item === 'string') {
        const cleaned = stripGatewayMetadata(item);
        if (cleaned) blocks.push({ type: 'text', text: cleaned });
        continue;
      }
      const block = normalizeContentBlock(item);
      if (block) {
        // Strip metadata from text blocks
        if (block.type === 'text' && block.text) {
          block.text = stripGatewayMetadata(block.text);
          if (!block.text) continue;
        }
        blocks.push(block);
      }
    }
    return blocks;
  }
  // Object — try to treat as a single block
  if (content && typeof content === 'object') {
    const block = normalizeContentBlock(content);
    if (block) return [block];
    // Fallback: stringify the object so it's visible rather than invisible
    return [{ type: 'text', text: JSON.stringify(content) }];
  }
  return [];
}

export function normalizeHistoryEntry(entry: unknown): Message | null {
  // Must be an object
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const raw = entry as Record<string, unknown>;

  // Must have a valid role
  const role = raw.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'system') return null;

  // Normalize content
  const content = normalizeContentToBlocks(raw.content);

  // Build normalized message
  const id = typeof raw.id === 'string' && raw.id ? raw.id : generateMessageId();

  // Use 0 sentinel for missing timestamps — Date.now() would misclassify
  // old messages as fresh in time-based comparisons (e.g. poll fallback).
  const timestamp =
    typeof raw.timestamp === 'number'
      ? raw.timestamp
      : typeof raw.createdAt === 'number'
        ? raw.createdAt
        : 0;

  const model = typeof raw.model === 'string' ? raw.model : undefined;

  return {
    id,
    role: role as MessageRole,
    content,
    timestamp,
    model,
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
  };
}

// ---- Stream Timer Cleanup -------------------------------------------------
// Centralized cleanup for _streamWatchdog and _pollFallback to prevent
// stale timer callbacks from firing after abort/failure/unsubscribe.
// Must be called on EVERY stream exit path.

function clearStreamTimers(get: () => ChatState, set: (partial: Partial<ChatState>) => void) {
  const watchdog = get()._streamWatchdog;
  const poll = get()._pollFallback;
  if (watchdog) clearTimeout(watchdog);
  if (poll) clearTimeout(poll);
  set({ _streamWatchdog: null, _pollFallback: null, _activeRunId: null });
}

// ---- Store ----------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeSessionKey: null,
  isStreaming: false,
  streamingMessageId: null,
  streamingBuffer: '',
  lastSeq: 0,
  attachments: [],
  sessionConfig: {
    model: undefined,
    temperature: 1.0,
    thinkingLevel: 'medium',
  },
  error: null,
  eventUnsubscribe: null,
  _streamWatchdog: null,
  _pollFallback: null,
  _activeRunId: null,

  setActiveSession: (sessionKey: string) => {
    const { activeSessionKey, unsubscribeFromEvents, subscribeToEvents } = get();

    if (activeSessionKey === sessionKey) return;

    // Unsubscribe from old session events
    unsubscribeFromEvents();

    // Reset state
    set({
      activeSessionKey: sessionKey,
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      streamingBuffer: '',
      lastSeq: 0,
      error: null,
    });

    // Subscribe to new session events
    subscribeToEvents();
  },

  loadHistory: async (sessionKey: string) => {
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ messages: unknown[] }>('chat.history', {
        sessionKey,
        limit: 1000,
      });

      // Guard against stale response: if session changed while awaiting,
      // discard the response to prevent overwriting the new session's messages.
      if (get().activeSessionKey !== sessionKey) return;

      const rawMessages = response.messages || [];
      const messages: Message[] = rawMessages
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((m): m is Message => m !== null)
        .filter((m) => !isSilentReplyMessage(m) && !isInternalSystemMessage(m));

      set({ messages });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load chat history';
      set({ error: errorMessage });
      console.error('[Chat] Failed to load history:', err);
    }
  },

  sendMessage: async (text: string, attachmentsToSend?: Attachment[]) => {
    const { activeSessionKey, attachments } = get();

    if (!activeSessionKey) {
      set({ error: 'No active session' });
      return;
    }

    try {
      set({ error: null });

      // Build message content
      const content: MessageContent[] = [{ type: 'text', text }];

      // Add attachments
      const allAttachments = attachmentsToSend || attachments;
      for (const att of allAttachments) {
        if (att.type.startsWith('image/')) {
          content.push({
            type: 'image',
            url: att.url || `data:${att.type};base64,${att.data}`,
            mimeType: att.type,
          });
        } else {
          content.push({
            type: 'file',
            name: att.name,
            url: att.url || `data:${att.type};base64,${att.data}`,
            mimeType: att.type,
          });
        }
      }

      // Add user message to local state immediately
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Clear previous timers
      clearStreamTimers(get, set);

      // Set streaming state BEFORE the await to prevent race condition
      // where events arrive between the await and the state update.
      // Also start a stream watchdog — if no events arrive within 30s,
      // force-exit streaming state so the UI doesn't get stuck.
      // Store the watchdog in state atomically with the streaming state
      // so clearStreamTimers can always find and cancel it.
      set((state) => {
        const watchdog = setTimeout(() => {
          const { isStreaming } = get();
          if (!isStreaming) return;
          console.warn('[Chat] Stream watchdog: no events received within 30s');
          clearStreamTimers(get, set);
          set({
            error: 'Stream stalled waiting for gateway events.',
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
        }, 30_000);

        return {
          messages: [...state.messages, userMessage],
          attachments: [], // Clear attachments after sending
          isStreaming: true,
          streamingMessageId: null,
          streamingBuffer: '',
          _streamWatchdog: watchdog,
          _pollFallback: null,
        };
      });

      // Send to gateway — chat.send is NON-BLOCKING per the protocol spec.
      // It returns { runId, status: "started" }. The actual AI response
      // arrives asynchronously via 'chat' events (delta/final).
      //
      // ChatSendParamsSchema fields:
      //   sessionKey (required), message (required), idempotencyKey (required),
      //   thinking? (string), deliver? (boolean), attachments? (TUnknown[]),
      //   timeoutMs? (integer)
      // NOTE: model is NOT a chat.send param — set it via sessions.patch instead.
      const { sessionConfig } = get();
      const { request } = useConnectionStore.getState();

      // Ensure model is applied before sending (sessions.patch is the only way)
      if (sessionConfig.model) {
        try {
          await request('sessions.patch', { key: activeSessionKey, model: sessionConfig.model });
        } catch (err) {
          console.warn('[Chat] Failed to patch model before send:', err);
        }
      }

      // Build the gateway attachments array from the UI attachments.
      // The schema defines: attachments?: TArray<TUnknown>
      // We use Anthropic-compatible content blocks; the gateway handles
      // provider-specific translation server-side.
      const gatewayAttachments: GatewayAttachment[] =
        allAttachments.length > 0 ? allAttachments.map(toGatewayAttachment) : [];

      // idempotencyKey is auto-injected by the gateway client for chat.send
      // (it's in SIDE_EFFECTING_METHODS). Don't pass one explicitly.
      const sendResult = await request<{ runId?: string; status?: string }>('chat.send', {
        sessionKey: activeSessionKey,
        message: text,
        ...(gatewayAttachments.length > 0 ? { attachments: gatewayAttachments } : {}),
        ...(sessionConfig.thinkingLevel && sessionConfig.thinkingLevel !== 'none'
          ? { thinking: sessionConfig.thinkingLevel }
          : {}),
      });

      // Capture runId for deterministic poll correlation
      if (sendResult.runId) {
        set({ _activeRunId: sendResult.runId });
      }

      console.log(
        '[Chat] chat.send acknowledged:',
        sendResult,
        gatewayAttachments.length > 0
          ? `(${gatewayAttachments.length} attachment(s) sent)`
          : '(no attachments)'
      );

      // Response arrives via chat events. As defense-in-depth, poll
      // history periodically to catch responses if events don't arrive
      // (e.g. subscription lost, event format changed, etc.).
      const sessionForPoll = activeSessionKey;
      const sentAt = Date.now();

      const pollForResponse = async () => {
        const { activeSessionKey: currentKey, messages: currentMsgs } = get();

        // Stop if session changed
        if (currentKey !== sessionForPoll) return;

        // Check if we already have a response (from events)
        const userMsgIdx = currentMsgs.findIndex((m) => m.id === userMessage.id);
        const hasAssistantAfter =
          userMsgIdx >= 0 && currentMsgs.slice(userMsgIdx + 1).some((m) => m.role === 'assistant');

        if (hasAssistantAfter) {
          // Events delivered the response — clean up
          clearStreamTimers(get, set);
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
          return;
        }

        // Give up after 30s — reload full history
        if (Date.now() - sentAt > 30_000) {
          console.warn('[Chat] Response poll timeout after 30s, reloading history');
          await get().loadHistory(sessionForPoll);
          clearStreamTimers(get, set);
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
          return;
        }

        // Poll history for a new assistant message.
        // Strategy: prefer runId metadata match, fall back to positional match
        // (first assistant message after the user message we sent).
        try {
          const { request: req } = useConnectionStore.getState();
          const activeRunId = get()._activeRunId;
          const histResp = await req<{ messages: unknown[] }>('chat.history', {
            sessionKey: sessionForPoll,
            limit: 50,
          });
          const allMsgs = (histResp.messages || [])
            .map((e) => normalizeHistoryEntry(e))
            .filter((m): m is Message => m !== null);

          // Strategy 1: Match by runId in message metadata (most reliable)
          let matchedAssistant: Message | undefined;
          if (activeRunId) {
            matchedAssistant = allMsgs.find(
              (m) => m.role === 'assistant' && m.metadata?.runId === activeRunId
            );
          }

          // Strategy 2: Positional match — find user message by text,
          // then take the first assistant message after it.
          if (!matchedAssistant) {
            const userIdx = allMsgs.findIndex(
              (m) =>
                m.role === 'user' && m.content.some((c) => c.type === 'text' && c.text === text)
            );
            if (userIdx >= 0) {
              matchedAssistant = allMsgs.slice(userIdx + 1).find((m) => m.role === 'assistant');
            }
          }

          // Strategy 3: Last resort — most recent assistant with a real timestamp
          if (!matchedAssistant) {
            const recentAssistant = allMsgs
              .filter((m) => m.role === 'assistant' && m.timestamp > 0)
              .pop();
            if (recentAssistant && recentAssistant.timestamp >= sentAt - 5_000) {
              matchedAssistant = recentAssistant;
            }
          }

          if (matchedAssistant && isSilentReplyMessage(matchedAssistant)) {
            // Silent token (NO_REPLY / HEARTBEAT_OK) — terminal outcome.
            // Stop polling immediately, don't add to messages.
            clearStreamTimers(get, set);
            set({ isStreaming: false, streamingMessageId: null, streamingBuffer: '' });
            console.log('[Chat] Silent token found via poll — suppressed');
            // Reload history to sync (filters will strip it)
            const sk = get().activeSessionKey;
            if (sk) {
              setTimeout(() => {
                if (get().activeSessionKey === sk) get().loadHistory(sk);
              }, 800);
            }
            return;
          }

          if (matchedAssistant) {
            // Found a real response — add if not already present
            clearStreamTimers(get, set);
            set((state) => {
              const uidx = state.messages.findIndex((m) => m.id === userMessage.id);
              const alreadyHas =
                uidx >= 0 && state.messages.slice(uidx + 1).some((m) => m.role === 'assistant');
              if (alreadyHas) {
                return {
                  isStreaming: false,
                  streamingMessageId: null,
                  streamingBuffer: '',
                };
              }
              return {
                messages: [...state.messages, matchedAssistant],
                isStreaming: false,
                streamingMessageId: null,
                streamingBuffer: '',
              };
            });
            console.log('[Chat] Response found via history poll fallback');
            return;
          }
        } catch (err) {
          console.warn('[Chat] Poll fallback error:', err);
        }

        // Schedule next poll (3s intervals).
        // Use the functional set form to atomically replace any existing poll
        // timer so clearStreamTimers always has a valid handle to cancel.
        set((state) => {
          if (state._pollFallback) clearTimeout(state._pollFallback);
          return { _pollFallback: setTimeout(pollForResponse, 3_000) };
        });
      };

      // Start first poll after 3s. Atomically store the handle so
      // clearStreamTimers can always cancel it regardless of timing.
      set((state) => {
        if (state._pollFallback) clearTimeout(state._pollFallback);
        return { _pollFallback: setTimeout(pollForResponse, 3_000) };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      clearStreamTimers(get, set);
      set({
        error: errorMessage,
        isStreaming: false,
        streamingMessageId: null,
        streamingBuffer: '',
      });
      console.error('[Chat] Failed to send message:', err);
    }
  },

  abortStream: async () => {
    const { activeSessionKey } = get();

    if (!activeSessionKey) return;

    const { request } = useConnectionStore.getState();

    try {
      // ChatAbortParamsSchema: { sessionKey, runId?: string }
      // No idempotencyKey field in schema — omit it.
      await request('chat.abort', {
        sessionKey: activeSessionKey,
      });
      clearStreamTimers(get, set);
      set({
        isStreaming: false,
        streamingMessageId: null,
        streamingBuffer: '',
      });
    } catch (err) {
      console.error('[Chat] Failed to abort stream:', err);
    }
  },

  injectNote: async (text: string) => {
    const { activeSessionKey } = get();

    if (!activeSessionKey) {
      set({ error: 'No active session' });
      return;
    }

    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      // ChatInjectParamsSchema: { sessionKey, message: string, label?: string }
      // NOTE: no idempotencyKey field in the schema — omit it.
      await request('chat.inject', {
        sessionKey: activeSessionKey,
        message: text,
      });

      // Add assistant note to local state
      const note: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: [{ type: 'text', text }],
        timestamp: Date.now(),
        metadata: { injected: true },
      };

      set((state) => ({
        messages: [...state.messages, note],
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to inject note';
      set({ error: errorMessage });
      console.error('[Chat] Failed to inject note:', err);
    }
  },

  addAttachment: (attachment: Attachment) => {
    set((state) => ({
      attachments: [...state.attachments, { ...attachment, id: generateAttachmentId() }],
    }));
  },

  addMultipleAttachments: (files: File[]) => {
    // Capture active session key at call time. If the session changes before
    // any FileReader callback fires, the attachment belongs to the old session
    // and should be discarded to avoid polluting the new session's state.
    const sessionKey = get().activeSessionKey;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        // Guard: discard if session changed while reading
        if (get().activeSessionKey !== sessionKey) return;

        const base64 = reader.result as string;
        const data = base64.split(',')[1] || base64;
        const attachment: Attachment = {
          id: generateAttachmentId(),
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          url: base64,
        };
        set((state) => ({
          attachments: [...state.attachments, attachment],
        }));
      };
      reader.readAsDataURL(file);
    }
  },

  removeAttachment: (attachmentId: string) => {
    set((state) => ({
      attachments: state.attachments.filter((att) => att.id !== attachmentId),
    }));
  },

  clearAttachments: () => {
    set({ attachments: [] });
  },

  updateSessionConfig: (config: Partial<SessionConfig>) => {
    set((state) => ({
      sessionConfig: { ...state.sessionConfig, ...config },
    }));

    // Persist config changes to gateway for the active session
    const { activeSessionKey } = get();
    if (!activeSessionKey) return;

    (async () => {
      try {
        const { request } = useConnectionStore.getState();
        const patch: Record<string, unknown> = {};
        if (config.model !== undefined) patch.model = config.model;
        if (config.thinkingLevel !== undefined) patch.thinkingLevel = config.thinkingLevel;
        if (Object.keys(patch).length > 0) {
          await request('sessions.patch', { key: activeSessionKey, ...patch });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update session config';
        console.error('[Chat] Failed to patch session config:', err);
        toast.error(errorMessage);
      }
    })();
  },

  subscribeToEvents: () => {
    const { activeSessionKey, eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    if (!activeSessionKey) return;

    // Subscribe synchronously — no async import race.
    const { subscribe } = useConnectionStore.getState();

    const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
      const { activeSessionKey: currentSession, streamingMessageId, lastSeq } = get();

      // Ignore events from other sessions
      if (payload.sessionKey !== currentSession) return;

      // ---- Normalize dual event schemas at entry point --------------------
      // Legacy schema: { delta, done, error, seq, messageId }
      // Alternate schema: { state, message, errorMessage }
      // We normalize to a unified internal shape before any further handling.
      //
      // IMPORTANT: Do not mutate the incoming payload — other subscribers may
      // be listening to the same 'chat' event. Build a normalized copy instead.
      //
      // NOTE: ChatEventPayload.state is intentionally typed as optional to
      // accommodate the legacy schema which omits it. The canonical schema
      // (ChatEventSchema) declares state as required.
      let normalized: ChatEventPayload;
      if (payload.state === undefined) {
        if (payload.error) {
          normalized = { ...payload, state: 'error' };
        } else if (payload.done) {
          normalized = { ...payload, state: 'final' };
        } else if (payload.delta !== undefined) {
          normalized = {
            ...payload,
            state: 'delta',
            // Wrap legacy delta string as a message so extractTextFromEventMessage works
            ...(typeof payload.delta === 'string' ? { message: payload.delta } : {}),
          };
        } else {
          normalized = payload;
        }
      } else {
        normalized = payload;
      }
      // ---- End normalization ----------------------------------------------

      // Any event for this session means stream is alive — cancel poll fallback
      // and refresh watchdog.
      const pollTimer = get()._pollFallback;
      if (pollTimer) {
        clearTimeout(pollTimer);
        set({ _pollFallback: null });
      }
      // Reset stream watchdog on every event — if no further events
      // arrive within 30s, force-exit streaming state.
      const watchdog = get()._streamWatchdog;
      if (watchdog) clearTimeout(watchdog);
      const nextWatchdog = setTimeout(() => {
        const { isStreaming } = get();
        if (!isStreaming) return;
        console.warn('[Chat] Stream watchdog: no events for 30s, force-exiting stream');
        clearStreamTimers(get, set);
        set({
          error: 'Stream stalled waiting for gateway events.',
          isStreaming: false,
          streamingMessageId: null,
          streamingBuffer: '',
        });
      }, 30_000);
      set({ _streamWatchdog: nextWatchdog });

      // Track sequence numbers (if present — guard for undefined from legacy schema)
      if (typeof normalized.seq === 'number' && normalized.seq > lastSeq) {
        set({ lastSeq: normalized.seq });
      }

      // Handle error — covers legacy { error: { message } | string } and
      // alternate { state: 'error', errorMessage } schemas.
      if (normalized.error || normalized.state === 'error' || normalized.errorMessage) {
        const rawError = normalized.error;
        const errorMessage =
          typeof rawError === 'string'
            ? rawError
            : rawError && typeof rawError === 'object' && 'message' in rawError
              ? (rawError as { message: string }).message
              : normalized.errorMessage || 'Chat request failed';

        clearStreamTimers(get, set);
        set({
          error: errorMessage,
          isStreaming: false,
          streamingMessageId: null,
          streamingBuffer: '',
        });
        return;
      }

      // Handle alternate gateway schema: final may carry the completed message
      if (normalized.state === 'final') {
        const finalText = extractTextFromEventMessage(normalized.message);
        const { streamingBuffer } = get();
        const effectiveText = finalText || streamingBuffer;

        // Suppress silent sentinel tokens (NO_REPLY, HEARTBEAT_OK)
        const strippedCheck = (effectiveText ?? '')
          .replace(/[.\s!?]+$/g, '')
          .trim()
          .toUpperCase();
        if (SILENT_REPLY_TOKENS.has(strippedCheck)) {
          clearStreamTimers(get, set);
          set({ isStreaming: false, streamingMessageId: null, streamingBuffer: '' });
          // Still reload history to sync
          const sessionForReload = get().activeSessionKey;
          if (sessionForReload) {
            setTimeout(() => {
              const { activeSessionKey: currentKey } = get();
              if (currentKey === sessionForReload) {
                get().loadHistory(sessionForReload);
              }
            }, 800);
          }
          return;
        }

        if (effectiveText) {
          const messageId = streamingMessageId || normalized.messageId || generateMessageId();
          set((state) => {
            const existingIndex = state.messages.findIndex((m) => m.id === messageId);
            const updatedMessage: Message = {
              id: messageId,
              role: 'assistant',
              content: [{ type: 'text', text: effectiveText }],
              timestamp: Date.now(),
            };

            if (existingIndex >= 0) {
              const messages = [...state.messages];
              messages[existingIndex] = updatedMessage;
              return { messages };
            }

            return { messages: [...state.messages, updatedMessage] };
          });
        }

        clearStreamTimers(get, set);
        set({
          isStreaming: false,
          streamingMessageId: null,
          streamingBuffer: '',
        });

        // Always reload history after final to sync with server truth.
        // If no text arrived at all (no deltas, no final message), this
        // is the only way to recover the assistant response.
        const sessionForReload = get().activeSessionKey;
        if (sessionForReload) {
          setTimeout(() => {
            const { activeSessionKey: currentKey } = get();
            if (currentKey === sessionForReload) {
              get().loadHistory(sessionForReload);
            }
          }, 800);

          // Refresh session list so derived titles update
          setTimeout(() => {
            useSessionsStore.getState().loadSessions();
          }, 1500);
        }
        return;
      }

      // Handle alternate gateway schema: aborted
      if (normalized.state === 'aborted') {
        clearStreamTimers(get, set);
        set({
          isStreaming: false,
          streamingMessageId: null,
          streamingBuffer: '',
        });
        return;
      }

      // Handle alternate gateway schema delta stream
      // Use a single atomic set() to avoid stale-closure bugs where two rapid
      // delta events read the same streamingBuffer from the outer closure.
      if (normalized.state === 'delta') {
        const deltaText = extractTextFromEventMessage(normalized.message);
        const resolvedMessageId = streamingMessageId || normalized.messageId || generateMessageId();

        set((state) => {
          const newBuffer = state.streamingBuffer + deltaText;
          const existingIndex = state.messages.findIndex((m) => m.id === resolvedMessageId);
          const updatedMessage: Message = {
            id: resolvedMessageId,
            role: 'assistant',
            content: [{ type: 'text', text: newBuffer }],
            timestamp: Date.now(),
          };

          const messages =
            existingIndex >= 0
              ? state.messages.map((m, i) => (i === existingIndex ? updatedMessage : m))
              : [...state.messages, updatedMessage];

          return {
            messages,
            streamingBuffer: newBuffer,
            streamingMessageId: resolvedMessageId,
          };
        });
        return;
      }
    });

    set({ eventUnsubscribe: unsub });
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribe } = get();
    clearStreamTimers(get, set);
    if (eventUnsubscribe) {
      eventUnsubscribe();
      set({ eventUnsubscribe: null });
    }
  },

  reset: () => {
    const { unsubscribeFromEvents } = get();
    unsubscribeFromEvents();
    set({
      messages: [],
      activeSessionKey: null,
      isStreaming: false,
      streamingMessageId: null,
      streamingBuffer: '',
      lastSeq: 0,
      attachments: [],
      sessionConfig: {
        model: undefined,
        temperature: 1.0,
        thinkingLevel: 'medium',
      },
      error: null,
      eventUnsubscribe: null,
      _streamWatchdog: null,
      _pollFallback: null,
      _activeRunId: null,
    });
  },
}));
