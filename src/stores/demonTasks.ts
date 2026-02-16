// ---------------------------------------------------------------------------
// Demon Tasks Store (Zustand) — Task Pipeline / Kanban
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

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

      const chatUnsub = subscribe<{
        event?: string;
        sessionKey?: string;
        agentId?: string;
        role?: string;
        content?: string;
        model?: string;
        done?: boolean;
        error?: string;
        spawnedBy?: string;
      }>('chat', (payload) => {
        const { tasks } = get();
        const agentId = payload.agentId;
        if (!agentId) return;

        // Detect delegation: a user message in a demon's session that was spawned by another demon
        if (payload.role === 'user' && payload.spawnedBy && payload.content) {
          const assignedInfo = getAgentInfo(agentId);
          const delegatorInfo = getAgentInfo(payload.spawnedBy);

          const newTask: DemonTask = {
            id: generateTaskId(),
            description:
              payload.content.length > 200 ? payload.content.slice(0, 200) + '…' : payload.content,
            status: 'queued',
            assignedTo: agentId,
            assignedToEmoji: assignedInfo.emoji,
            assignedToName: assignedInfo.name,
            delegatedBy: payload.spawnedBy,
            delegatedByEmoji: delegatorInfo.emoji,
            delegatedByName: delegatorInfo.name,
            sessionKey: payload.sessionKey ?? '',
            model: payload.model ?? '',
            cliBackend: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            error: null,
          };

          // Limit to MAX_TASKS, drop oldest done/failed
          const trimmed = [...tasks, newTask];
          if (trimmed.length > MAX_TASKS) {
            const doneIdx = trimmed.findIndex((t) => t.status === 'done' || t.status === 'failed');
            if (doneIdx !== -1) {
              trimmed.splice(doneIdx, 1);
            } else {
              trimmed.shift();
            }
          }

          set({ tasks: trimmed });
          return;
        }

        // Detect assistant response starting = in_progress
        if (payload.role === 'assistant' && payload.content) {
          const sessionKey = payload.sessionKey ?? '';
          const updated = tasks.map((t) => {
            if (t.assignedTo === agentId && t.sessionKey === sessionKey && t.status === 'queued') {
              return {
                ...t,
                status: 'in_progress' as const,
                startedAt: Date.now(),
                model: payload.model ?? t.model,
              };
            }
            return t;
          });
          set({ tasks: updated });
          return;
        }

        // Detect done = mark task complete
        if (payload.done) {
          const sessionKey = payload.sessionKey ?? '';
          const updated = tasks.map((t) => {
            if (
              t.assignedTo === agentId &&
              t.sessionKey === sessionKey &&
              t.status === 'in_progress'
            ) {
              return {
                ...t,
                status: 'done' as const,
                completedAt: Date.now(),
              };
            }
            return t;
          });
          set({ tasks: updated });
          return;
        }

        // Detect error
        if (payload.error) {
          const sessionKey = payload.sessionKey ?? '';
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
                error: payload.error ?? 'Unknown error',
              };
            }
            return t;
          });
          set({ tasks: updated });
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
