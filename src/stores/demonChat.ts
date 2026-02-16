// ---------------------------------------------------------------------------
// Demon Chat Room Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { ChatEventPayload } from '@/stores/chat';
import type { Agent } from '@/stores/agents';

// ---- Types ----------------------------------------------------------------

export interface DemonChatMessage {
  id: string;
  demonId: string;
  demonName: string;
  demonEmoji: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  timestamp: number;
  isDelegation: boolean;
  targetDemonId?: string;
}

interface DemonChatState {
  messages: DemonChatMessage[];
  activeDemonFilters: Set<string>;
  isListening: boolean;

  // Internal
  _unsubscribe: Unsubscribe | null;
  _connUnsub: Unsubscribe | null;

  // Actions
  startListening: () => void;
  stopListening: () => void;
  /** Full teardown — stops listening AND removes the connection watcher. Use on view unmount. */
  teardown: () => void;
  toggleDemonFilter: (demonId: string) => void;
  injectMessage: (demonId: string, message: string) => Promise<void>;
  getFilteredMessages: () => DemonChatMessage[];
}

// ---- Constants ------------------------------------------------------------

const MAX_MESSAGES = 500;

// ---- Helpers --------------------------------------------------------------

function generateId(): string {
  return `dcm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Match an agent from a sessionKey (which is often prefixed with agentId). */
function matchAgentFromSessionKey(sessionKey: string, agents: Agent[]): Agent | undefined {
  // Direct prefix match on agent id
  let match = agents.find((a) => sessionKey.startsWith(a.id));
  if (match) return match;

  // Fallback: check if any agent name appears in session key
  match = agents.find(
    (a) => a.identity?.name && sessionKey.toLowerCase().includes(a.identity.name.toLowerCase())
  );
  return match;
}

/** Detect delegation patterns in message content. */
function detectDelegation(
  content: string,
  agents: Array<{ id: string; identity?: { name?: string } }>
): { isDelegation: boolean; targetDemonId?: string } {
  // Match patterns like "→ Buer", "delegate to Malphas", "delegating to Andromalius"
  const delegationPatterns = [
    /(?:delegat(?:e|ing|ed)\s+(?:to|this\s+to))\s+(\w+)/i,
    /\u2192\s+(\w+)/,
    /(?:hand(?:ing)?\s+off\s+to|assigning\s+to|routing\s+to)\s+(\w+)/i,
  ];

  for (const pattern of delegationPatterns) {
    const match = content.match(pattern);
    if (match) {
      const targetName = match[1]!.toLowerCase();
      const targetAgent = agents.find(
        (a) => a.id.toLowerCase() === targetName || a.identity?.name?.toLowerCase() === targetName
      );
      if (targetAgent) {
        return { isDelegation: true, targetDemonId: targetAgent.id };
      }
    }
  }

  return { isDelegation: false };
}

// ---- Store ----------------------------------------------------------------

export const useDemonChatStore = create<DemonChatState>((set, get) => ({
  messages: [],
  activeDemonFilters: new Set<string>(),
  isListening: false,
  _unsubscribe: null,
  _connUnsub: null,

  startListening: () => {
    const { isListening } = get();

    // Optimistic lock to prevent concurrent startListening calls
    if (isListening) return;

    // Clean up any stale subscriptions from a prior failed start
    const { _unsubscribe, _connUnsub } = get();
    if (_unsubscribe) _unsubscribe();
    if (_connUnsub) _connUnsub();

    set({ isListening: true, _unsubscribe: null, _connUnsub: null });

    (async () => {
      try {
        const { useConnectionStore } = await import('./connection');
        const { useAgentsStore } = await import('./agents');
        const { subscribe } = useConnectionStore.getState();

        // Fresh Map on each startListening call prevents stale buffers on reconnect
        const streamBuffers = new Map<string, string>();
        // Track which sessionKeys have an active stream without messageId,
        // so concurrent anonymous streams get unique buffer keys
        let anonStreamCounter = 0;
        // Limitation: anonymous streams (no messageId) are tracked one-at-a-time per session.
        // If the gateway sends interleaved deltas for multiple concurrent anonymous streams
        // in the same session, content may merge. This is inherent to the protocol — without
        // a stable stream identifier, concurrent anonymous streams cannot be disambiguated.
        // In practice, demon sessions process one message at a time, so this is safe.
        const activeAnonKeys = new Map<string, string>(); // sessionKey → bufferKey

        const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
          // ChatEventPayload has: sessionKey, messageId, delta, seq, done, error
          // It does NOT have role/content/agentId — we infer agent from sessionKey
          if (!payload.delta && !payload.done && !payload.error) return;

          const agents = useAgentsStore.getState().agents;
          const sessionKey = payload.sessionKey;

          const matchedAgent = matchAgentFromSessionKey(sessionKey, agents);
          if (!matchedAgent) return;

          // Clear buffer on error to prevent stale data contaminating later streams
          if (payload.error) {
            if (payload.messageId) {
              streamBuffers.delete(payload.messageId);
            } else {
              const anonKey = activeAnonKeys.get(sessionKey);
              if (anonKey) {
                streamBuffers.delete(anonKey);
                activeAnonKeys.delete(sessionKey);
              }
            }
            return;
          }

          // Stable buffer key: messageId when present, otherwise a per-session counter key
          let bufferKey: string;
          if (payload.messageId) {
            bufferKey = payload.messageId;
          } else {
            // For streams without messageId, assign a unique key per active stream
            let existing = activeAnonKeys.get(sessionKey);
            if (!existing) {
              anonStreamCounter += 1;
              existing = `${sessionKey}:anon:${anonStreamCounter}`;
              activeAnonKeys.set(sessionKey, existing);
            }
            bufferKey = existing;
          }

          // Accumulate deltas into buffer
          if (payload.delta) {
            const prev = streamBuffers.get(bufferKey) ?? '';
            streamBuffers.set(bufferKey, prev + payload.delta);
          }

          // Only emit a complete message when done=true
          if (!payload.done) return;

          const content = streamBuffers.get(bufferKey) ?? '';
          streamBuffers.delete(bufferKey);
          activeAnonKeys.delete(sessionKey);
          if (!content) return;

          const msgId = payload.messageId ?? generateId();

          const demonId = matchedAgent.id;
          const demonName = matchedAgent.identity?.name ?? matchedAgent.id;
          const demonEmoji = matchedAgent.identity?.emoji ?? '';
          const { isDelegation, targetDemonId } = detectDelegation(content, agents);

          const msg: DemonChatMessage = {
            id: msgId,
            demonId,
            demonName,
            demonEmoji,
            sessionKey,
            role: 'assistant',
            content,
            model: '',
            timestamp: Date.now(),
            isDelegation,
            targetDemonId,
          };

          set((state) => {
            const newMessages = [...state.messages, msg];
            if (newMessages.length > MAX_MESSAGES) {
              return { messages: newMessages.slice(newMessages.length - MAX_MESSAGES) };
            }
            return { messages: newMessages };
          });
        });

        // Watch for connection lifecycle to auto-stop/restart
        let prevStatus = useConnectionStore.getState().status;
        const connUnsub = useConnectionStore.subscribe((state) => {
          const curr = state.status;
          if (curr === 'disconnected' || curr === 'error') {
            get().stopListening();
          } else if (curr === 'connected' && prevStatus !== 'connected') {
            // Auto-restart on reconnect (guard prevents loop since startListening checks isListening)
            const { isListening: listening } = get();
            if (!listening) {
              get().startListening();
            }
          }
          prevStatus = curr;
        });

        // Only mark as listening if we got a real subscription (not noop)
        const { status } = useConnectionStore.getState();
        set({ _unsubscribe: unsub, _connUnsub: connUnsub, isListening: status === 'connected' });
      } catch (error) {
        console.error('[DemonChat] Failed to start listening:', error);
        set({ isListening: false, _unsubscribe: null, _connUnsub: null });
      }
    })();
  },

  stopListening: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    // Note: _connUnsub is intentionally preserved so the connection watcher
    // can trigger auto-restart on reconnect. It is only cleared when the
    // view explicitly tears down via the cleanup in startListening or
    // when a new startListening call replaces it.
    set({ _unsubscribe: null, isListening: false });
  },

  teardown: () => {
    const { _unsubscribe, _connUnsub } = get();
    if (_unsubscribe) _unsubscribe();
    if (_connUnsub) _connUnsub();
    set({ _unsubscribe: null, _connUnsub: null, isListening: false });
  },

  toggleDemonFilter: (demonId: string) => {
    set((state) => {
      const next = new Set(state.activeDemonFilters);
      if (next.has(demonId)) {
        next.delete(demonId);
      } else {
        next.add(demonId);
      }
      return { activeDemonFilters: next };
    });
  },

  injectMessage: async (demonId: string, message: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    // Find an active session for the demon via sessions.list
    const sessionsResult = await request<{
      sessions: Array<{ key: string; agentId?: string }>;
    }>('sessions.list', {
      limit: 200,
      includeGlobal: true,
      includeUnknown: true,
    });

    const demonSession = sessionsResult.sessions.find(
      (s) => s.agentId === demonId || s.key.startsWith(demonId)
    );

    if (!demonSession) {
      console.warn(`[DemonChat] No active session found for demon ${demonId}`);
      return;
    }

    await request('chat.send', {
      sessionKey: demonSession.key,
      message,
      idempotencyKey: crypto.randomUUID(),
    });
  },

  getFilteredMessages: () => {
    const { messages, activeDemonFilters } = get();
    if (activeDemonFilters.size === 0) return messages;
    return messages.filter((m) => activeDemonFilters.has(m.demonId));
  },
}));
