// ---------------------------------------------------------------------------
// Demon Health Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { Agent } from '@/stores/agents';
import type { SessionListItem } from '@/stores/sessions';
import type { ChatEventPayload } from '@/stores/chat';

// ---- Types ----------------------------------------------------------------

export interface DemonStatus {
  demonId: string;
  demonName: string;
  demonEmoji: string;
  state: 'idle' | 'working' | 'error' | 'offline';
  currentTask: string | null;
  activeModel: string;
  activeSessions: number;
  lastActivity: number;
  uptime: number;
  cliBackend: {
    active: boolean;
    tool: 'claude-code' | 'codex' | null;
    startedAt: number | null;
  };
}

interface DemonHealthState {
  demons: DemonStatus[];
  isMonitoring: boolean;

  // Internal refs (not serializable)
  _chatUnsub: Unsubscribe | null;
  _execUnsub: Unsubscribe | null;
  _idleCheckInterval: ReturnType<typeof setInterval> | null;
  _execTimeouts: ReturnType<typeof setTimeout>[];

  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  refreshAll: () => Promise<void>;
}

// ---- Idle threshold -------------------------------------------------------

const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ---- Helpers --------------------------------------------------------------

function buildDemonFromAgent(agent: Agent): DemonStatus {
  return {
    demonId: agent.id,
    demonName: agent.identity?.name ?? agent.name ?? agent.id,
    demonEmoji: agent.identity?.emoji ?? '👤',
    state: 'offline',
    currentTask: null,
    activeModel: '',
    activeSessions: 0,
    lastActivity: 0,
    uptime: Date.now(),
    cliBackend: { active: false, tool: null, startedAt: null },
  };
}

// ---- Store ----------------------------------------------------------------

export const useDemonHealthStore = create<DemonHealthState>((set, get) => ({
  demons: [],
  isMonitoring: false,
  _chatUnsub: null,
  _execUnsub: null,
  _idleCheckInterval: null,
  _execTimeouts: [],

  startMonitoring: () => {
    const { isMonitoring } = get();
    if (isMonitoring) return;

    // Set immediately to prevent async race (duplicate subscriptions)
    set({ isMonitoring: true });

    (async () => {
      try {
        const { useConnectionStore } = await import('./connection');
        const { useAgentsStore } = await import('./agents');
        const { subscribe } = useConnectionStore.getState();

        // Initialize demons from agents store
        const { agents } = useAgentsStore.getState();
        if (agents.length > 0) {
          set({
            demons: agents.map(buildDemonFromAgent),
          });
        } else {
          // Agents not loaded yet — load them first
          await useAgentsStore.getState().loadAgents();
          const freshAgents = useAgentsStore.getState().agents;
          set({
            demons: freshAgents.map(buildDemonFromAgent),
          });
        }

        // Subscribe to chat events to detect working/idle state
        const chatUnsub = subscribe<ChatEventPayload>('chat', (payload) => {
          const { demons } = get();

          // Match agent from sessionKey
          const { agents } = useAgentsStore.getState();
          const matchedAgent =
            agents.find((a) => payload.sessionKey.startsWith(a.id)) ??
            agents.find(
              (a) =>
                a.identity?.name &&
                payload.sessionKey.toLowerCase().includes(a.identity.name.toLowerCase())
            );
          const agentId = matchedAgent?.id;
          if (!agentId) return;

          const prev = demons.find((d) => d.demonId === agentId);
          if (!prev) return;

          let state: DemonStatus['state'] = 'working';
          let currentTask = prev.currentTask;

          if (payload.done) {
            state = 'idle';
            currentTask = null;
          } else if (payload.delta) {
            // First delta of a new message = working
            state = 'working';
          }

          set({
            demons: demons.map((d) =>
              d.demonId === agentId ? { ...d, lastActivity: Date.now(), state, currentTask } : d
            ),
          });
        });

        // Subscribe to exec approval events to detect CLI backend usage
        const execUnsub = subscribe<{
          agentId?: string;
          command?: string;
        }>('exec.approval.requested', (payload) => {
          const { demons } = get();
          const agentId = payload.agentId;
          if (!agentId) return;

          if (!demons.some((d) => d.demonId === agentId)) return;

          const cmd = payload.command ?? '';
          const isClaude = cmd.startsWith('claude');
          const isCodex = cmd.startsWith('codex');
          if (!isClaude && !isCodex) return;

          // Mark CLI backend as active
          set({
            demons: demons.map((d) =>
              d.demonId === agentId
                ? {
                    ...d,
                    cliBackend: {
                      active: true,
                      tool: isClaude ? 'claude-code' : 'codex',
                      startedAt: Date.now(),
                    },
                    lastActivity: Date.now(),
                  }
                : d
            ),
          });

          // Auto-clear after 10 minutes (no completion event available)
          const timeoutId = setTimeout(
            () => {
              const { demons: current } = get();
              const demon = current.find((d) => d.demonId === agentId);
              if (demon?.cliBackend.active && demon.cliBackend.startedAt) {
                const elapsed = Date.now() - demon.cliBackend.startedAt;
                if (elapsed >= 10 * 60 * 1000) {
                  set({
                    demons: current.map((d) =>
                      d.demonId === agentId
                        ? { ...d, cliBackend: { active: false, tool: null, startedAt: null } }
                        : d
                    ),
                  });
                }
              }
              // Self-remove from tracked timeouts to prevent memory leak
              set((state) => ({
                _execTimeouts: state._execTimeouts.filter((t) => t !== timeoutId),
              }));
            },
            10 * 60 * 1000
          );
          set((state) => ({ _execTimeouts: [...state._execTimeouts, timeoutId] }));
        });

        // Periodic idle check — mark demons as idle if no activity for 5 min
        const idleCheckInterval = setInterval(() => {
          const { demons } = get();
          const now = Date.now();
          let changed = false;
          const updated = demons.map((d) => {
            if (d.state === 'working' && now - d.lastActivity > IDLE_THRESHOLD_MS) {
              changed = true;
              return { ...d, state: 'idle' as const, currentTask: null };
            }
            return d;
          });
          if (changed) set({ demons: updated });
        }, 30_000);

        set({
          _chatUnsub: chatUnsub,
          _execUnsub: execUnsub,
          _idleCheckInterval: idleCheckInterval,
        });

        // Initial refresh
        get().refreshAll();
      } catch (err) {
        console.error('[DemonHealth] Failed to start monitoring:', err);
        set({
          isMonitoring: false,
          _chatUnsub: null,
          _execUnsub: null,
          _idleCheckInterval: null,
          _execTimeouts: [],
        });
      }
    })();
  },

  stopMonitoring: () => {
    const { _chatUnsub, _execUnsub, _idleCheckInterval, _execTimeouts } = get();
    _chatUnsub?.();
    _execUnsub?.();
    if (_idleCheckInterval) clearInterval(_idleCheckInterval);
    for (const t of _execTimeouts) clearTimeout(t);
    set({
      isMonitoring: false,
      _chatUnsub: null,
      _execUnsub: null,
      _idleCheckInterval: null,
      _execTimeouts: [],
    });
  },

  refreshAll: async () => {
    try {
      const { useConnectionStore } = await import('./connection');
      const { request } = useConnectionStore.getState();

      const response = await request<{ sessions: SessionListItem[] }>('sessions.list', {
        limit: 200,
        includeDerivedTitles: true,
        includeLastMessage: true,
        includeGlobal: true,
        includeUnknown: true,
      });

      const sessions = response.sessions ?? [];
      const { demons } = get();

      const updated = demons.map((demon) => {
        const demonSessions = sessions.filter((s) => s.agentId === demon.demonId);
        const activeSessions = demonSessions.length;
        const lastActivity = demonSessions.reduce(
          (max, s) => Math.max(max, s.lastActive ?? 0),
          demon.lastActivity
        );
        const latestSession = demonSessions.sort(
          (a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0)
        )[0];
        const activeModel = latestSession?.model ?? demon.activeModel;
        const state =
          demon.state === 'offline' && activeSessions > 0 ? ('idle' as const) : demon.state;

        return {
          ...demon,
          state,
          activeSessions,
          lastActivity,
          activeModel,
        };
      });

      set({ demons: updated });
    } catch (err) {
      console.error('[DemonHealth] Failed to refresh:', err);
    }
  },
}));
