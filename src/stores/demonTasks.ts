// ---------------------------------------------------------------------------
// Demon Tasks Store (Zustand) — Task Pipeline / Kanban
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { ChatEventPayload } from '@/stores/chat';

// ---- Types ----------------------------------------------------------------

export interface DemonTask {
  id: string;
  description: string;
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  assignedTo: string;
  assignedToEmoji: string;
  assignedToName: string;
  delegatedBy: string;
  delegatedByEmoji: string;
  delegatedByName: string;
  sessionKey: string;
  model: string;
  cliBackend: 'claude-code' | 'codex' | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

interface DemonTasksState {
  tasks: DemonTask[];
  filterDemon: string | null;
  isTracking: boolean;

  // Internal refs
  _chatUnsub: Unsubscribe | null;

  // Actions
  startTracking: () => void;
  stopTracking: () => void;
  setFilter: (demonId: string | null) => void;
  getFilteredTasks: () => DemonTask[];
}

// ---- Constants ------------------------------------------------------------

const MAX_TASKS = 100;

// ---- Helpers --------------------------------------------------------------

let taskCounter = 0;

function generateTaskId(): string {
  taskCounter += 1;
  return `task-${Date.now()}-${taskCounter}`;
}

// ---- Store ----------------------------------------------------------------

export const useDemonTasksStore = create<DemonTasksState>((set, get) => ({
  tasks: [],
  filterDemon: null,
  isTracking: false,
  _chatUnsub: null,

  startTracking: () => {
    const { isTracking } = get();
    if (isTracking) return;

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { useAgentsStore } = await import('./agents');
      const { subscribe } = useConnectionStore.getState();

      // Build agent lookup for emoji/name resolution
      const getAgentInfo = (agentId: string) => {
        const { agents } = useAgentsStore.getState();
        const agent = agents.find((a) => a.id === agentId);
        return {
          name: agent?.identity?.name ?? agent?.name ?? agentId,
          emoji: agent?.identity?.emoji ?? '👤',
        };
      };

      // Track streaming sessions to detect new tasks
      const streamingSessions = new Set<string>();

      const chatUnsub = subscribe<ChatEventPayload>('chat', (payload) => {
        const { tasks } = get();
        const { agents } = useAgentsStore.getState();

        // Match agent from sessionKey
        const matchedAgent =
          agents.find((a) => payload.sessionKey.startsWith(a.id)) ??
          agents.find(
            (a) =>
              a.identity?.name &&
              payload.sessionKey.toLowerCase().includes(a.identity.name.toLowerCase())
          );
        if (!matchedAgent) return;
        const agentId = matchedAgent.id;

        // Handle errors
        if (payload.error) {
          const sessionKey = payload.sessionKey;
          streamingSessions.delete(sessionKey);
          const updated = tasks.map((t) => {
            if (
              t.assignedTo === agentId &&
              t.sessionKey === sessionKey &&
              (t.status === 'in_progress' || t.status === 'queued')
            ) {
              return {
                ...t,
                status: 'failed' as const,
                completedAt: Date.now(),
                error: payload.error?.message ?? 'Unknown error',
              };
            }
            return t;
          });
          set({ tasks: updated });
          return;
        }

        // Handle done
        if (payload.done) {
          const sessionKey = payload.sessionKey;
          streamingSessions.delete(sessionKey);
          const updated = tasks.map((t) => {
            if (
              t.assignedTo === agentId &&
              t.sessionKey === sessionKey &&
              t.status === 'in_progress'
            ) {
              return { ...t, status: 'done' as const, completedAt: Date.now() };
            }
            return t;
          });
          set({ tasks: updated });
          return;
        }

        // Handle delta — first delta for a session creates a task, subsequent ones mark in_progress
        if (payload.delta) {
          const sessionKey = payload.sessionKey;

          if (!streamingSessions.has(sessionKey)) {
            streamingSessions.add(sessionKey);

            // Check if we already have a task for this session
            const existing = tasks.find(
              (t) => t.assignedTo === agentId && t.sessionKey === sessionKey
            );
            if (!existing) {
              const info = getAgentInfo(agentId);
              const newTask: DemonTask = {
                id: generateTaskId(),
                description: `Session ${sessionKey}`,
                status: 'in_progress',
                assignedTo: agentId,
                assignedToEmoji: info.emoji,
                assignedToName: info.name,
                delegatedBy: '',
                delegatedByEmoji: '',
                delegatedByName: '',
                sessionKey,
                model: '',
                cliBackend: null,
                createdAt: Date.now(),
                startedAt: Date.now(),
                completedAt: null,
                error: null,
              };

              const trimmed = [...tasks, newTask];
              if (trimmed.length > MAX_TASKS) {
                const doneIdx = trimmed.findIndex(
                  (t) => t.status === 'done' || t.status === 'failed'
                );
                if (doneIdx !== -1) trimmed.splice(doneIdx, 1);
                else trimmed.shift();
              }
              set({ tasks: trimmed });
            }
          }
        }
      });

      set({ isTracking: true, _chatUnsub: chatUnsub });
    })();
  },

  stopTracking: () => {
    const { _chatUnsub } = get();
    _chatUnsub?.();
    set({ isTracking: false, _chatUnsub: null });
  },

  setFilter: (demonId: string | null) => {
    set({ filterDemon: demonId });
  },

  getFilteredTasks: () => {
    const { tasks, filterDemon } = get();
    if (!filterDemon) return tasks;
    return tasks.filter((t) => t.assignedTo === filterDemon || t.delegatedBy === filterDemon);
  },
}));
