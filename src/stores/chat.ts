// ---------------------------------------------------------------------------
// Chat Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Message Types --------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageContent {
  type: 'text' | 'image' | 'file' | 'tool_use' | 'tool_result';
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

export interface ChatEventPayload {
  sessionKey: string;
  messageId?: string;
  delta?: string;
  seq: number;
  done?: boolean;
  error?: {
    code: string;
    message: string;
  };
  // Alternate gateway shape (observed in OpenClaw UI/client code paths)
  state?: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
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
        if (item && typeof item === 'object' && 'text' in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean);
    return parts.join('\n');
  }
  if (message && typeof message === 'object' && 'text' in message) {
    const text = (message as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
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
    model: 'claude-sonnet-4-5',
    temperature: 1.0,
    thinkingLevel: 'medium',
  },
  error: null,
  eventUnsubscribe: null,

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

      const response = await request<{ messages: Message[] }>('chat.history', {
        sessionKey,
        limit: 1000,
      });

      set({ messages: response.messages || [] });
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
      await request('chat.send', {
        sessionKey: activeSessionKey,
        message: text,
        idempotencyKey: crypto.randomUUID(),
      });

      // Mark as streaming (assistant response will arrive via events)
      set({
        isStreaming: true,
        streamingMessageId: null,
        streamingBuffer: '',
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

        // Track sequence numbers (if present)
        if (payload.seq > lastSeq) {
          set({ lastSeq: payload.seq });
        }

        // Handle error shape used by current store schema
        if (payload.error) {
          set({
            error: payload.error.message,
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
          return;
        }

        // Handle alternate gateway schema: { state: 'error', errorMessage }
        if (payload.state === 'error' || payload.errorMessage) {
          set({
            error: payload.errorMessage || 'Chat request failed',
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
          return;
        }

        // Handle alternate gateway schema: { state: 'final' | 'aborted' }
        if (payload.state === 'final' || payload.state === 'aborted') {
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
          return;
        }

        // Handle alternate gateway schema delta stream
        if (payload.state === 'delta') {
          const text = extractTextFromEventMessage(payload.message);
          const newBuffer = text || streamingBuffer;
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

        // Handle streaming deltas
        if (payload.delta) {
          const newBuffer = streamingBuffer + payload.delta;
          const messageId = streamingMessageId || payload.messageId || generateMessageId();

          set({
            streamingBuffer: newBuffer,
            streamingMessageId: messageId,
          });

          // Update or create the streaming message
          set((state) => {
            const existingIndex = state.messages.findIndex((m) => m.id === messageId);
            const updatedMessage: Message = {
              id: messageId,
              role: 'assistant',
              content: [{ type: 'text', text: newBuffer }],
              timestamp: Date.now(),
            };

            if (existingIndex >= 0) {
              const newMessages = [...state.messages];
              newMessages[existingIndex] = updatedMessage;
              return { messages: newMessages };
            } else {
              return { messages: [...state.messages, updatedMessage] };
            }
          });
        }

        // Handle completion
        if (payload.done) {
          set({
            isStreaming: false,
            streamingMessageId: null,
            streamingBuffer: '',
          });
        }
      });

      set({ eventUnsubscribe: unsub });
    })();
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribe } = get();
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
        model: 'claude-sonnet-4-5',
        temperature: 1.0,
        thinkingLevel: 'medium',
      },
      error: null,
      eventUnsubscribe: null,
    });
  },
}));
