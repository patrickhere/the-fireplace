// ---------------------------------------------------------------------------
// Demon Tasks Store (Zustand) — Task Pipeline / Kanban
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { ChatEventPayload } from '@/stores/chat';
import { detectConflicts } from '@/lib/conflictDetection';
import type { DemonConflict } from '@/lib/conflictDetection';

// ---- Types ----------------------------------------------------------------

export interface DelegationStep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  timestamp: number;
}

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
  // Explicit task protocol (D1)
  isExplicit: boolean;
  delegationChain: DelegationStep[];
}

interface DemonTasksState {
  tasks: DemonTask[];
  conflicts: DemonConflict[];
  filterDemon: string | null;
  isTracking: boolean;

  // Internal refs
  _chatUnsub: Unsubscribe | null;
  _conflictInterval: ReturnType<typeof setInterval> | null;

  // Actions
  startTracking: () => void;
  stopTracking: () => void;
  setFilter: (demonId: string | null) => void;
  getFilteredTasks: () => DemonTask[];
  createExplicitTask: (description: string, assignTo: string) => Promise<void>;
  refreshConflicts: () => void;
  resolveConflict: (id: string) => Promise<void>;
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
  conflicts: [],
  filterDemon: null,
  isTracking: false,
  _chatUnsub: null,
  _conflictInterval: null,

  startTracking: () => {
    const { isTracking } = get();
    if (isTracking) return;

    (async () => {
      try {
        const { useConnectionStore } = await import('./connection');
        const { useAgentsStore } = await import('./agents');
        const { status, subscribe } = useConnectionStore.getState();

        // Guard: only track when connected
        if (status !== 'connected') return;

        // Set isTracking: true only after confirming connection is live
        set({ isTracking: true });

        // Load plan cache from disk (best-effort)
        import('@/stores/planCache')
          .then(({ usePlanCacheStore }) => usePlanCacheStore.getState().loadFromDisk())
          .catch(() => {});

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
            agents.find(
              (a) =>
                payload.sessionKey === a.id ||
                payload.sessionKey.startsWith(a.id + ':') ||
                payload.sessionKey.startsWith(a.id + '/')
            ) ??
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
                  error:
                    typeof payload.error === 'string'
                      ? payload.error
                      : (payload.error?.message ?? 'Unknown error'),
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
                // Cache plan from completed explicit tasks
                if (t.isExplicit && typeof payload.delta === 'string') {
                  import('@/stores/planCache')
                    .then(({ usePlanCacheStore }) => {
                      usePlanCacheStore
                        .getState()
                        .cachePlan(t.description, payload.delta as string, t.assignedTo);
                    })
                    .catch(() => {});
                }
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

                // Check for explicit task marker in delta text
                const deltaText = typeof payload.delta === 'string' ? payload.delta : '';
                const taskMatch = deltaText.match(/\[TASK::([^\]]+)\]\s*(.*)/);
                const delegateMatch = deltaText.match(/\[DELEGATE::([^:]+)::([^\]]+)\]/);

                const description = taskMatch
                  ? taskMatch[2] || `Task ${taskMatch[1] ?? ''}`
                  : `Session ${sessionKey}`;
                const taskId = taskMatch?.[1] ?? generateTaskId();

                // Track delegation chain
                const delegationChain: DelegationStep[] = [];
                if (delegateMatch?.[1]) {
                  const targetId = delegateMatch[1];
                  const targetInfo = getAgentInfo(targetId);
                  delegationChain.push({
                    fromId: agentId,
                    fromName: info.name,
                    toId: targetId,
                    toName: targetInfo.name,
                    timestamp: Date.now(),
                  });
                }

                const newTask: DemonTask = {
                  id: taskId,
                  description,
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
                  isExplicit: !!taskMatch,
                  delegationChain,
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

        set({ _chatUnsub: chatUnsub });

        // Run an initial conflict detection pass, then repeat every 30s
        get().refreshConflicts();
        const conflictInterval = setInterval(() => {
          get().refreshConflicts();
        }, 30_000);
        set({ _conflictInterval: conflictInterval });
      } catch (err) {
        console.error('[DemonTasks] Failed to start tracking:', err);
        set({ isTracking: false, _chatUnsub: null });
      }
    })();
  },

  stopTracking: () => {
    const { _chatUnsub, _conflictInterval } = get();
    _chatUnsub?.();
    if (_conflictInterval !== null) clearInterval(_conflictInterval);
    set({ isTracking: false, _chatUnsub: null, _conflictInterval: null });
  },

  setFilter: (demonId: string | null) => {
    set({ filterDemon: demonId });
  },

  getFilteredTasks: () => {
    const { tasks, filterDemon } = get();
    if (!filterDemon) return tasks;
    return tasks.filter((t) => t.assignedTo === filterDemon || t.delegatedBy === filterDemon);
  },

  refreshConflicts: () => {
    const { tasks, conflicts: existing } = get();

    // Build activity from recent tasks (descriptions + assigned demon info)
    const activity = tasks.map((t) => ({
      demonId: t.assignedTo,
      demonName: t.assignedToName,
      demonEmoji: t.assignedToEmoji,
      text: t.description,
      timestamp: t.startedAt ?? t.createdAt,
    }));

    const fresh = detectConflicts(activity);

    // Preserve resolved state for conflicts that already existed
    const resolvedIds = new Set(existing.filter((c) => c.resolved).map((c) => c.id));

    // Merge: keep resolved conflicts that are still present, add new ones
    const merged = fresh.map((c) => {
      // Match against existing by type+resource to preserve resolved flag
      const prev = existing.find((e) => e.type === c.type && e.resource === c.resource);
      return prev ? { ...c, id: prev.id, resolved: prev.resolved } : c;
    });

    // Also keep any manually resolved conflicts not in the fresh set (so UI shows them briefly)
    for (const old of existing) {
      if (old.resolved && resolvedIds.has(old.id)) {
        const stillPresent = merged.some((c) => c.id === old.id);
        if (!stillPresent) merged.push(old);
      }
    }

    set({ conflicts: merged });
  },

  resolveConflict: async (id: string) => {
    const { conflicts } = get();
    const conflict = conflicts.find((c) => c.id === id);
    if (!conflict) return;

    // Mark resolved
    set({
      conflicts: conflicts.map((c) => (c.id === id ? { ...c, resolved: true } : c)),
    });

    // Create a Calcifer adjudication task
    const description =
      `[ADJUDICATE] Conflict detected: ${conflict.demons.map((d) => d.name).join(' and ')} ` +
      `both referenced ${conflict.type === 'file' ? 'file' : 'topic'} "${conflict.resource}". ` +
      `Please review and coordinate.`;

    try {
      await get().createExplicitTask(description, 'calcifer');
    } catch {
      // Adjudication task creation is best-effort — conflict is already marked resolved
    }
  },

  createExplicitTask: async (description: string, assignTo: string) => {
    const { useConnectionStore } = await import('./connection');
    const { useAgentsStore } = await import('./agents');
    const { request } = useConnectionStore.getState();
    const { agents } = useAgentsStore.getState();

    const agent = agents.find((a) => a.id === assignTo);
    const info = {
      name: agent?.identity?.name ?? agent?.name ?? assignTo,
      emoji: agent?.identity?.emoji ?? '',
    };

    const taskId = generateTaskId();

    // Check plan cache for a reusable plan skeleton
    let planContext = '';
    try {
      const { usePlanCacheStore } = await import('@/stores/planCache');
      const cached = usePlanCacheStore.getState().findPlan(description);
      if (cached) {
        planContext = `\n\n[CACHED_PLAN]\n${cached.skeleton}\n[/CACHED_PLAN]`;
        usePlanCacheStore.getState().markUsed(cached.hash);
      }
    } catch {
      // Plan cache unavailable — proceed without
    }

    const message = `[TASK::${taskId}] ${description}${planContext}`;

    // Send as chat message to the agent
    try {
      const { toast } = await import('sonner');
      await request('chat.send', {
        agentId: assignTo,
        message,
      });

      // Add to local task list immediately as queued
      const newTask: DemonTask = {
        id: taskId,
        description,
        status: 'queued',
        assignedTo: assignTo,
        assignedToEmoji: info.emoji,
        assignedToName: info.name,
        delegatedBy: 'operator',
        delegatedByEmoji: '',
        delegatedByName: 'Operator',
        sessionKey: '',
        model: '',
        cliBackend: null,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        error: null,
        isExplicit: true,
        delegationChain: [],
      };

      set((state) => {
        const tasks = [...state.tasks, newTask];
        if (tasks.length > MAX_TASKS) {
          const doneIdx = tasks.findIndex((t) => t.status === 'done' || t.status === 'failed');
          if (doneIdx !== -1) tasks.splice(doneIdx, 1);
          else tasks.shift();
        }
        return { tasks };
      });

      toast.success(`Task assigned to ${info.name}`);
    } catch (err) {
      const { toast } = await import('sonner');
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      toast.error(msg);
    }
  },
}));
