// ---------------------------------------------------------------------------
// Cron Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Cron Types -----------------------------------------------------------

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // Cron expression
  command: string;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CronExecution {
  id: string;
  jobId: string;
  jobName: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'success' | 'failed';
  exitCode?: number;
  output?: string;
  error?: string;
}

// ---- Event Payload Types --------------------------------------------------

export interface CronJobEventPayload {
  jobId: string;
  type: 'created' | 'updated' | 'deleted' | 'executed';
  timestamp: number;
}

export interface CronExecutionEventPayload {
  id: string;
  jobId: string;
  status: 'running' | 'success' | 'failed';
  timestamp: number;
}

// ---- Store Types ----------------------------------------------------------

interface CronState {
  // Data
  jobs: CronJob[];
  executions: CronExecution[];
  selectedJob: CronJob | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  showCreateModal: boolean;
  showHistoryModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadJobs: () => Promise<void>;
  loadExecutions: (jobId?: string, limit?: number) => Promise<void>;
  createJob: (name: string, schedule: string, command: string, enabled?: boolean) => Promise<void>;
  updateJob: (id: string, updates: Partial<Omit<CronJob, 'id' | 'createdAt'>>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  enableJob: (id: string) => Promise<void>;
  disableJob: (id: string) => Promise<void>;
  runJob: (id: string) => Promise<void>;
  setSelectedJob: (job: CronJob | null) => void;
  setShowCreateModal: (show: boolean) => void;
  setShowHistoryModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useCronStore = create<CronState>((set, get) => ({
  // Initial state
  jobs: [],
  executions: [],
  selectedJob: null,
  isLoading: false,
  error: null,
  showCreateModal: false,
  showHistoryModal: false,
  eventUnsubscribe: null,

  loadJobs: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ jobs: CronJob[] }>('cron.list', {
        includeNext: true,
      });

      set({
        jobs: response.jobs || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cron jobs';
      set({ error: errorMessage, isLoading: false });
      console.error('[Cron] Failed to load jobs:', err);
    }
  },

  loadExecutions: async (jobId?: string, limit = 50) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ executions: CronExecution[] }>('cron.history', {
        jobId,
        limit,
      });

      set({
        executions: response.executions || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load execution history';
      set({ error: errorMessage });
      console.error('[Cron] Failed to load executions:', err);
    }
  },

  createJob: async (name: string, schedule: string, command: string, enabled = true) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.add', {
        name,
        schedule,
        command,
        enabled,
      });

      // Reload jobs
      get().loadJobs();
      set({ showCreateModal: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to create job:', err);
    }
  },

  updateJob: async (id: string, updates: Partial<Omit<CronJob, 'id' | 'createdAt'>>) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.update', {
        id,
        ...updates,
      });

      // Reload jobs
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to update job:', err);
    }
  },

  deleteJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.remove', {
        id,
      });

      // Remove from local state
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to delete job:', err);
    }
  },

  enableJob: async (id: string) => {
    await get().updateJob(id, { enabled: true });
  },

  disableJob: async (id: string) => {
    await get().updateJob(id, { enabled: false });
  },

  runJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.run', {
        id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to run job:', err);
    }
  },

  setSelectedJob: (job: CronJob | null) => {
    set({ selectedJob: job });
  },

  setShowCreateModal: (show: boolean) => {
    set({ showCreateModal: show });
  },

  setShowHistoryModal: (show: boolean) => {
    set({ showHistoryModal: show });
    if (show && get().executions.length === 0) {
      get().loadExecutions();
    }
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      // Subscribe to cron job events
      const unsub1 = subscribe<CronJobEventPayload>('cron', (payload) => {
        console.log('[Cron] Job event:', payload);

        // Reload jobs on any cron event
        if (['created', 'updated', 'deleted', 'executed'].includes(payload.type)) {
          get().loadJobs();
        }
      });

      // Subscribe to execution events
      const unsub2 = subscribe<CronExecutionEventPayload>('cron.execution', (payload) => {
        console.log('[Cron] Execution event:', payload);

        // Update execution in local state if history is visible
        if (get().showHistoryModal) {
          get().loadExecutions();
        }
      });

      set({
        eventUnsubscribe: () => {
          unsub1();
          unsub2();
        },
      });
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
      jobs: [],
      executions: [],
      selectedJob: null,
      isLoading: false,
      error: null,
      showCreateModal: false,
      showHistoryModal: false,
      eventUnsubscribe: null,
    });
  },
}));
