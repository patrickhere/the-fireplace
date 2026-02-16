// ---------------------------------------------------------------------------
// Demon Chat Room Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { ChatEventPayload } from '@/stores/chat';

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

  // Actions
  startListening: () => void;
  stopListening: () => void;
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

  startListening: () => {
    const { _unsubscribe } = get();

    // Avoid double-subscribe
    if (_unsubscribe) {
      _unsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { useAgentsStore } = await import('./agents');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
        // We only care about events that have content (deltas with done=true or full messages)
        if (!payload.done && !payload.delta) return;

        // Only process completed messages (done=true) to avoid partial duplicates
        if (!payload.done) return;

        const agents = useAgentsStore.getState().agents;

        // Try to match agentId from the payload — chat events include sessionKey
        // which is often prefixed with the agentId
        const sessionKey = payload.sessionKey;
        let matchedAgent = agents.find((a) => sessionKey.startsWith(a.id));

        // Fallback: check if any agent name appears in session key
        if (!matchedAgent) {
          matchedAgent = agents.find(
            (a) =>
              a.identity?.name && sessionKey.toLowerCase().includes(a.identity.name.toLowerCase())
          );
        }

        // If we can't identify a demon, skip (it's not a demon session)
        if (!matchedAgent) return;

        const demonId = matchedAgent.id;
        const demonName = matchedAgent.identity?.name ?? matchedAgent.id;
        const demonEmoji = matchedAgent.identity?.emoji ?? '';

        // Build content from the delta or reconstruct
        const content = payload.delta ?? '';
        if (!content) return;

        const { isDelegation, targetDemonId } = detectDelegation(content, agents);

        const msg: DemonChatMessage = {
          id: payload.messageId ?? generateId(),
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
          // Cap at MAX_MESSAGES — drop oldest
          if (newMessages.length > MAX_MESSAGES) {
            return { messages: newMessages.slice(newMessages.length - MAX_MESSAGES) };
          }
          return { messages: newMessages };
        });
      });

      set({ _unsubscribe: unsub, isListening: true });
    })();
  },

  stopListening: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) {
      _unsubscribe();
    }
    set({ _unsubscribe: null, isListening: false });
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
    }>('sessions.list', {});

    const demonSession = sessionsResult.sessions.find(
      (s) => s.agentId === demonId || s.key.startsWith(demonId)
    );

    if (!demonSession) {
      console.warn(`[DemonChat] No active session found for demon ${demonId}`);
      return;
    }

    await request('chat.send', {
      sessionKey: demonSession.key,
      message: [{ type: 'text', text: message }],
    });
  },

  getFilteredMessages: () => {
    const { messages, activeDemonFilters } = get();
    if (activeDemonFilters.size === 0) return messages;
    return messages.filter((m) => activeDemonFilters.has(m.demonId));
  },
}));
