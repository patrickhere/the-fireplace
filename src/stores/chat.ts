// ---------------------------------------------------------------------------
// Chat Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

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

function extractTextFromEventMessage(message: unknown): string {
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

function normalizeContentToBlocks(content: unknown): MessageContent[] {
  // Already a string — wrap as single text block
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  // Array of content blocks
  if (Array.isArray(content)) {
    const blocks: MessageContent[] = [];
    for (const item of content) {
      if (typeof item === 'string') {
        blocks.push({ type: 'text', text: item });
        continue;
      }
      const block = normalizeContentBlock(item);
      if (block) blocks.push(block);
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

function normalizeHistoryEntry(entry: unknown): Message | null {
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

  const timestamp =
    typeof raw.timestamp === 'number'
      ? raw.timestamp
      : typeof raw.createdAt === 'number'
        ? raw.createdAt
        : Date.now();

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
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ messages: unknown[] }>('chat.history', {
        sessionKey,
        limit: 1000,
      });

      const rawMessages = response.messages || [];
      const messages: Message[] = rawMessages
        .map((entry) => normalizeHistoryEntry(entry))
        .filter((m): m is Message => m !== null);

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

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

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

      set((state) => ({
        messages: [...state.messages, userMessage],
        attachments: [], // Clear attachments after sending
      }));

      // Send to gateway (non-blocking, responses come via events)
      const { sessionConfig } = get();
      await request('chat.send', {
        sessionKey: activeSessionKey,
        message: text,
        idempotencyKey: crypto.randomUUID(),
        ...(sessionConfig.model ? { model: sessionConfig.model } : {}),
      });

      // Mark as streaming (assistant response will arrive via events)
      const prevWatchdog = get()._streamWatchdog;
      if (prevWatchdog) clearTimeout(prevWatchdog);
      const streamWatchdog = setTimeout(() => {
        const { isStreaming } = get();
        if (!isStreaming) return;
        set({
          error: 'No response events received from gateway (backend likely failed).',
          isStreaming: false,
          streamingMessageId: null,
          streamingBuffer: '',
          _streamWatchdog: null,
        });
      }, 30_000);

      set({
        isStreaming: true,
        streamingMessageId: null,
        streamingBuffer: '',
        _streamWatchdog: streamWatchdog,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      set({ error: errorMessage, isStreaming: false });
      console.error('[Chat] Failed to send message:', err);
    }
  },

  abortStream: async () => {
    const { activeSessionKey } = get();

    if (!activeSessionKey) return;

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      await request('chat.abort', {
        sessionKey: activeSessionKey,
        idempotencyKey: crypto.randomUUID(),
      });
      const watchdog = get()._streamWatchdog;
      if (watchdog) clearTimeout(watchdog);
      set({
        isStreaming: false,
        streamingMessageId: null,
        streamingBuffer: '',
        _streamWatchdog: null,
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

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('chat.inject', {
        sessionKey: activeSessionKey,
        content: [{ type: 'text', text }],
        idempotencyKey: crypto.randomUUID(),
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
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
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
        const { useConnectionStore } = await import('./connection');
        const { request } = useConnectionStore.getState();
        const patch: Record<string, unknown> = {};
        if (config.model !== undefined) patch.model = config.model;
        if (config.thinkingLevel !== undefined) patch.thinkingLevel = config.thinkingLevel;
        if (Object.keys(patch).length > 0) {
          await request('sessions.patch', { key: activeSessionKey, ...patch });
        }
      } catch (err) {
        console.error('[Chat] Failed to patch session config:', err);
      }
    })();
  },

  subscribeToEvents: () => {
    const { activeSessionKey, eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    if (!activeSessionKey) return;

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
        const {
          activeSessionKey: currentSession,
          streamingMessageId,
          streamingBuffer,
          lastSeq,
        } = get();

        // Ignore events from other sessions
        if (payload.sessionKey !== currentSession) return;

        // ---- Normalize dual event schemas at entry point --------------------
        // Legacy schema: { delta, done, error, seq, messageId }
        // Alternate schema: { state, message, errorMessage }
        // We normalize to a unified internal shape before any further handling.
        //
        // If the payload has `delta` or `done` (legacy) but no `state`,
        // synthesize `state` so the rest of the handler can use a single path.
        if (payload.state === undefined) {
          if (payload.error) {
            (payload as ChatEventPayload).state = 'error';
          } else if (payload.done) {
            (payload as ChatEventPayload).state = 'final';
          } else if (payload.delta !== undefined) {
            (payload as ChatEventPayload).state = 'delta';
            // Wrap legacy delta string as a message so extractTextFromEventMessage works
            if (typeof payload.delta === 'string') {
              (payload as ChatEventPayload).message = payload.delta;
            }
          }
        }
        // ---- End normalization ----------------------------------------------

        // Any event for this session means stream is alive — refresh watchdog.
        const watchdog = get()._streamWatchdog;
        if (watchdog) {
          clearTimeout(watchdog);
          const nextWatchdog = setTimeout(() => {
            const { isStreaming } = get();
            if (!isStreaming) return;
            set({
              error: 'Stream stalled waiting for gateway events.',
              isStreaming: false,
              streamingMessageId: null,
              streamingBuffer: '',
              _streamWatchdog: null,
            });
          }, 30_000);
          set({ _streamWatchdog: nextWatchdog });
        }

        // Track sequence numbers (if present)
        if (payload.seq > lastSeq) {
          set({ lastSeq: payload.seq });
        }

        // Handle error — covers legacy { error: { message } | string } and
        // alternate { state: 'error', errorMessage } schemas.
        if (payload.error || payload.state === 'error' || payload.errorMessage) {
          const rawError = payload.error;
          const errorMessage =
            typeof rawError === 'string'
              ? rawError
              : rawError && typeof rawError === 'object' && 'message' in rawError
                ? (rawError as { message: string }).message
                : payload.errorMessage || 'Chat request failed';

          const activeWatchdog = get()._streamWatchdog;
          if (activeWatchdog) clearTimeout(activeWatchdog);
          set({
            error: errorMessage,
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
            _streamWatchdog: null,
          });
          return;
        }

        // Handle alternate gateway schema: final may carry the completed message
        if (payload.state === 'final') {
          const finalText = extractTextFromEventMessage(payload.message);
          if (finalText) {
            const messageId = streamingMessageId || payload.messageId || generateMessageId();
            set((state) => {
              const existingIndex = state.messages.findIndex((m) => m.id === messageId);
              const updatedMessage: Message = {
                id: messageId,
                role: 'assistant',
                content: [{ type: 'text', text: finalText }],
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

          const activeWatchdog = get()._streamWatchdog;
          if (activeWatchdog) clearTimeout(activeWatchdog);
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
            _streamWatchdog: null,
          });
          return;
        }

        // Handle alternate gateway schema: aborted
        if (payload.state === 'aborted') {
          const activeWatchdog = get()._streamWatchdog;
          if (activeWatchdog) clearTimeout(activeWatchdog);
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
            _streamWatchdog: null,
          });
          return;
        }

        // Handle alternate gateway schema delta stream
        if (payload.state === 'delta') {
          const text = extractTextFromEventMessage(payload.message);
          const newBuffer = streamingBuffer + text;
          const messageId = streamingMessageId || payload.messageId || generateMessageId();

          set({
            streamingBuffer: newBuffer,
            streamingMessageId: messageId,
          });

          set((state) => {
            const existingIndex = state.messages.findIndex((m) => m.id === messageId);
            const updatedMessage: Message = {
              id: messageId,
              role: 'assistant',
              content: [{ type: 'text', text: newBuffer }],
              timestamp: Date.now(),
            };

            if (existingIndex >= 0) {
              const messages = [...state.messages];
              messages[existingIndex] = updatedMessage;
              return { messages };
            }

            return { messages: [...state.messages, updatedMessage] };
          });
          return;
        }
      });

      set({ eventUnsubscribe: unsub });
    })();
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribe } = get();
    const watchdog = get()._streamWatchdog;
    if (watchdog) clearTimeout(watchdog);
    if (eventUnsubscribe) {
      eventUnsubscribe();
      set({ eventUnsubscribe: null, _streamWatchdog: null });
      return;
    }
    set({ _streamWatchdog: null });
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
    });
  },
}));
