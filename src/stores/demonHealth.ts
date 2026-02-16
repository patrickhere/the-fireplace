// ---------------------------------------------------------------------------
// Demon Health Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { Agent } from '@/stores/agents';
import type { SessionListItem } from '@/stores/sessions';

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
  _refreshInterval: ReturnType<typeof setInterval> | null;
  _idleCheckInterval: ReturnType<typeof setInterval> | null;

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
  _refreshInterval: null,
  _idleCheckInterval: null,

  startMonitoring: () => {
    const { isMonitoring } = get();
    if (isMonitoring) return;

    (async () => {
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
      const chatUnsub = subscribe<{
        event?: string;
        sessionKey?: string;
        agentId?: string;
        role?: string;
        content?: string;
        model?: string;
        done?: boolean;
      }>('chat', (payload) => {
        const { demons } = get();
        const agentId = payload.agentId;
        if (!agentId) return;

        const prev = demons.find((d) => d.demonId === agentId);
        if (!prev) return;

        let currentTask = prev.currentTask;
        if (payload.role === 'user' && payload.content) {
          currentTask =
            payload.content.length > 120 ? payload.content.slice(0, 120) + '…' : payload.content;
        }

        let state: DemonStatus['state'] = 'working';
        if (payload.done) {
          state = 'idle';
          currentTask = null;
        }

        set({
          demons: demons.map((d) =>
            d.demonId === agentId
              ? {
                  ...d,
                  lastActivity: Date.now(),
                  state,
                  currentTask,
                  activeModel: payload.model ?? d.activeModel,
                }
              : d
          ),
        });
      });

      // Subscribe to exec approval events to detect CLI backend usage
      const execUnsub = subscribe<{
        agentId?: string;
        command?: string;
        status?: string;
        startedAt?: number;
      }>('exec.approval', (payload) => {
        const { demons } = get();
        const agentId = payload.agentId;
        if (!agentId) return;

        if (!demons.some((d) => d.demonId === agentId)) return;

        const cmd = payload.command ?? '';
        const isClaude = cmd.startsWith('claude');
        const isCodex = cmd.startsWith('codex');
        if (!isClaude && !isCodex) return;

        const cliBackend: DemonStatus['cliBackend'] =
          payload.status === 'completed' || payload.status === 'denied'
            ? { active: false, tool: null, startedAt: null }
            : {
                active: true,
                tool: isClaude ? 'claude-code' : 'codex',
                startedAt: payload.startedAt ?? Date.now(),
              };

        set({
          demons: demons.map((d) =>
            d.demonId === agentId ? { ...d, cliBackend, lastActivity: Date.now() } : d
          ),
        });
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
        isMonitoring: true,
        _chatUnsub: chatUnsub,
        _execUnsub: execUnsub,
        _idleCheckInterval: idleCheckInterval,
      });

      // Initial refresh
      get().refreshAll();
    })();
  },

  stopMonitoring: () => {
    const { _chatUnsub, _execUnsub, _refreshInterval, _idleCheckInterval } = get();
    _chatUnsub?.();
    _execUnsub?.();
    if (_refreshInterval) clearInterval(_refreshInterval);
    if (_idleCheckInterval) clearInterval(_idleCheckInterval);
    set({
      isMonitoring: false,
      _chatUnsub: null,
      _execUnsub: null,
      _refreshInterval: null,
      _idleCheckInterval: null,
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

        return {
          ...demon,
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
