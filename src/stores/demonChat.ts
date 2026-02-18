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
  _agentsUnsub: Unsubscribe | null;
  _cronPoll: ReturnType<typeof setInterval> | null;
  /** Guard against double-injection: { demonId, text, ts } of the last inject call. */
  _lastInject: { demonId: string; text: string; ts: number } | null;

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
const INJECT_DEBOUNCE_MS = 2000;

// ---- Helpers --------------------------------------------------------------

function generateId(): string {
  return `dcm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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

/** Match an agent from a sessionKey (which is often prefixed with agentId). */
function matchAgentFromSessionKey(sessionKey: string, agents: Agent[]): Agent | undefined {
  // Canonical format: "agent:<agentId>:..."
  const canonicalMatch = sessionKey.match(/^agent:([^:]+):/);
  if (canonicalMatch?.[1]) {
    const byCanonicalId = agents.find((a) => a.id === canonicalMatch[1]);
    if (byCanonicalId) return byCanonicalId;
  }

  // Generic token match — also check "agent:<agentId>" prefix (BUG FIX #6 related)
  let match = agents.find(
    (a) =>
      sessionKey.includes(`:${a.id}:`) ||
      sessionKey.startsWith(`agent:${a.id}`) ||
      sessionKey.startsWith(a.id)
  );
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
  _agentsUnsub: null,
  _cronPoll: null,
  _lastInject: null,

  startListening: () => {
    const { isListening } = get();

    // Guard against concurrent startListening calls
    if (isListening) return;

    // BUG FIX #4: Call previous _connUnsub() before creating a new one to
    // prevent leaking connection watchers on every disconnect/reconnect cycle.
    const { _unsubscribe, _connUnsub, _agentsUnsub, _cronPoll } = get();
    if (_unsubscribe) _unsubscribe();
    if (_connUnsub) _connUnsub();
    if (_agentsUnsub) _agentsUnsub();
    if (_cronPoll) clearInterval(_cronPoll);

    // BUG FIX #3: Do NOT set isListening: true here. Only set it after the
    // subscription is confirmed live. Premature isListening prevents retry
    // if the initial subscription fails.
    set({ _unsubscribe: null, _connUnsub: null, _agentsUnsub: null, _cronPoll: null });

    (async () => {
      try {
        const { useConnectionStore } = await import('./connection');
        const { useAgentsStore } = await import('./agents');

        // BUG FIX #2: If the gateway client is not yet connected, subscribe() returns
        // NOOP_UNSUBSCRIBE — a silent no-op that drops all events. Instead, watch for
        // the connection to become available and call startListening() from there.
        // Do NOT set isListening: true until a real subscription is established.
        const connectionState = useConnectionStore.getState();
        if (connectionState.status !== 'connected') {
          const pendingConnUnsub = useConnectionStore.subscribe((state) => {
            if (state.status === 'connected') {
              // Remove this watcher first so startListening sees a clean slate.
              const stored = get()._connUnsub;
              if (stored === pendingConnUnsub) {
                set({ _connUnsub: null });
              }
              pendingConnUnsub();
              get().startListening();
            }
          });
          set({ _connUnsub: pendingConnUnsub });
          return;
        }

        const { subscribe } = connectionState;

        const pullCronPulseSummaries = async (): Promise<void> => {
          try {
            const { request } = useConnectionStore.getState();
            const jobsRes = await request<{
              jobs?: Array<{
                id: string;
                name?: string;
                agentId?: string;
                tags?: string[];
                payload?: { kind?: string };
              }>;
            }>('cron.list', { includeDisabled: true });
            const jobs = jobsRes.jobs ?? [];

            // BUG FIX #7: Identify demon pulse jobs robustly — don't rely on the
            // exact "demon pulse" name string. Prefer tag-based matching, then
            // agentId+kind, then a broad name heuristic as last resort.
            const pulseJobs = jobs.filter((j) => {
              const tags = j.tags ?? [];
              if (tags.some((t) => t === 'demon-pulse' || t === 'demon_pulse' || t === 'pulse')) {
                return true;
              }
              if (j.payload?.kind === 'agentTurn' && Boolean(j.agentId)) {
                return true;
              }
              const name = (j.name ?? '').toLowerCase();
              return name.includes('pulse') || name.includes('demon');
            });
            if (pulseJobs.length === 0) return;

            for (const job of pulseJobs) {
              const runsRes = await request<{
                entries?: Array<{
                  jobId: string;
                  sessionId?: string;
                  sessionKey?: string;
                  runAtMs?: number;
                  ts?: number;
                  status: string;
                  summary?: string;
                }>;
              }>('cron.runs', { id: job.id, limit: 5 });

              const entries = (runsRes.entries ?? []).filter(
                (e) => e.status === 'ok' && typeof e.summary === 'string' && e.summary.length > 0
              );
              if (entries.length === 0) continue;

              const allAgents = useAgentsStore.getState().agents;
              const matchedAgent =
                (job.agentId ? allAgents.find((a) => a.id === job.agentId) : undefined) ??
                allAgents.find((a) => a.id === 'calcifer');
              if (!matchedAgent) continue;

              for (const entry of entries) {
                const idSource =
                  entry.sessionId ??
                  entry.sessionKey ??
                  `${entry.jobId}:${entry.runAtMs ?? entry.ts ?? 0}`;
                const msgId = `cron_${idSource}`;

                set((state) => {
                  if (state.messages.some((m) => m.id === msgId)) return state;
                  const msg: DemonChatMessage = {
                    id: msgId,
                    demonId: matchedAgent.id,
                    demonName: matchedAgent.identity?.name ?? matchedAgent.id,
                    demonEmoji: matchedAgent.identity?.emoji ?? '',
                    sessionKey: entry.sessionKey ?? `cron:${entry.jobId}`,
                    role: 'assistant',
                    content: entry.summary ?? '',
                    model: '',
                    timestamp: entry.runAtMs ?? entry.ts ?? Date.now(),
                    isDelegation: false,
                  };

                  const next = [...state.messages, msg];
                  if (next.length > MAX_MESSAGES) {
                    return { messages: next.slice(next.length - MAX_MESSAGES) };
                  }
                  return { messages: next };
                });
              }
            }
          } catch (error) {
            console.error('[DemonChat] Failed to pull cron pulse summaries:', error);
          }
        };

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

        // BUG FIX #1: Buffer events that arrive before the agents list is loaded.
        // Events are held in pendingEventQueue and replayed once agents become available.
        const pendingEventQueue: ChatEventPayload[] = [];
        let agentsReady = useAgentsStore.getState().agents.length > 0;

        const processEvent = (payload: ChatEventPayload): void => {
          // ChatEventPayload may be either:
          // - delta/done/error shape
          // - state/message/errorMessage shape
          if (
            !payload.delta &&
            !payload.done &&
            !payload.error &&
            !payload.state &&
            !payload.errorMessage
          )
            return;

          const agents = useAgentsStore.getState().agents;
          const sessionKey = payload.sessionKey;

          const matchedAgent = matchAgentFromSessionKey(sessionKey, agents);
          if (!matchedAgent) return;

          // Handle alternate gateway schema: { state: 'error', errorMessage }
          if (payload.state === 'error' || payload.errorMessage) {
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

          // Handle alternate gateway schema delta stream
          if (payload.state === 'delta') {
            const deltaText = extractTextFromEventMessage(payload.message);
            if (deltaText) {
              const key = payload.messageId ?? `${sessionKey}:state`;
              const prev = streamBuffers.get(key) ?? '';
              streamBuffers.set(key, prev + deltaText);
            }
            return;
          }

          // Handle alternate gateway schema final event
          if (payload.state === 'final') {
            const key = payload.messageId ?? `${sessionKey}:state`;
            const finalText = extractTextFromEventMessage(payload.message);
            const content = finalText || streamBuffers.get(key) || '';
            streamBuffers.delete(key);
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
        };

        // Subscribe to chat events. This is now guaranteed to be a real subscription
        // (not NOOP) because we verified status === 'connected' above.
        const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
          if (!agentsReady) {
            // Agents haven't loaded yet — buffer this event for replay (BUG FIX #1)
            pendingEventQueue.push(payload);
            return;
          }
          processEvent(payload);
        });

        // BUG FIX #1 (continued): Watch agents store. Once agents load, replay queue.
        // This watcher self-terminates after agents are loaded.
        const agentsUnsub = useAgentsStore.subscribe((agentsState) => {
          if (!agentsReady && agentsState.agents.length > 0) {
            agentsReady = true;
            const queued = pendingEventQueue.splice(0);
            for (const payload of queued) {
              processEvent(payload);
            }
            set({ _agentsUnsub: null });
            agentsUnsub();
          }
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

        // Fallback feed: cron pulse summaries are not always emitted on chat stream,
        // so poll recent runs and inject summaries into this room.
        await pullCronPulseSummaries();
        const cronPoll = setInterval(() => {
          void pullCronPulseSummaries();
        }, 10_000);

        // BUG FIX #2 + #3: Set isListening: true only now — after the subscription
        // is confirmed live (we verified status === 'connected' before subscribing).
        // This is the single authoritative place where isListening becomes true.
        set({
          _unsubscribe: unsub,
          _connUnsub: connUnsub,
          _agentsUnsub: agentsUnsub,
          _cronPoll: cronPoll,
          isListening: true,
        });
      } catch (error) {
        console.error('[DemonChat] Failed to start listening:', error);
        set({
          isListening: false,
          _unsubscribe: null,
          _connUnsub: null,
          _agentsUnsub: null,
          _cronPoll: null,
        });
      }
    })();
  },

  stopListening: () => {
    const { _unsubscribe, _agentsUnsub, _cronPoll } = get();
    if (_unsubscribe) _unsubscribe();
    if (_agentsUnsub) _agentsUnsub();
    if (_cronPoll) clearInterval(_cronPoll);
    // Note: _connUnsub is intentionally preserved so the connection watcher
    // can trigger auto-restart on reconnect. It is only cleared when the
    // view explicitly tears down via the cleanup in startListening or
    // when a new startListening call replaces it.
    set({ _unsubscribe: null, _agentsUnsub: null, _cronPoll: null, isListening: false });
  },

  teardown: () => {
    const { _unsubscribe, _connUnsub, _agentsUnsub, _cronPoll } = get();
    if (_unsubscribe) _unsubscribe();
    if (_connUnsub) _connUnsub();
    if (_agentsUnsub) _agentsUnsub();
    if (_cronPoll) clearInterval(_cronPoll);
    set({
      _unsubscribe: null,
      _connUnsub: null,
      _agentsUnsub: null,
      _cronPoll: null,
      isListening: false,
    });
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
    // Guard against double-injection: reject if same demonId+text within debounce window
    const { _lastInject } = get();
    const now = Date.now();
    if (
      _lastInject &&
      _lastInject.demonId === demonId &&
      _lastInject.text === message &&
      now - _lastInject.ts < INJECT_DEBOUNCE_MS
    ) {
      console.warn('[DemonChat] Duplicate injection suppressed within debounce window');
      return;
    }
    set({ _lastInject: { demonId, text: message, ts: now } });

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

    // BUG FIX #6: Session keys use "agent:<agentId>" prefix, not bare demonId.
    // Match against s.agentId (if gateway provides it) or the canonical prefix.
    const demonSession = sessionsResult.sessions.find(
      (s) => s.agentId === demonId || s.key.startsWith(`agent:${demonId}`)
    );

    if (!demonSession) {
      console.warn(`[DemonChat] No active session found for demon ${demonId}`);
      return;
    }

    // ChatInjectParamsSchema: { sessionKey, message: string, label?: string }
    await request('chat.inject', {
      sessionKey: demonSession.key,
      message,
    });
  },

  getFilteredMessages: () => {
    const { messages, activeDemonFilters } = get();
    if (activeDemonFilters.size === 0) return messages;
    return messages.filter((m) => activeDemonFilters.has(m.demonId));
  },
}));
