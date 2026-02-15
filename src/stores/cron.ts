// ---------------------------------------------------------------------------
// Cron & Automation Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Types ----------------------------------------------------------------

export interface CronSchedule {
  kind: 'at' | 'every' | 'cron';
  at?: string;
  every?: string;
  cron?: string;
  timezone?: string;
}

export interface CronPayload {
  kind: 'systemEvent' | 'agentTurn';
  event?: string;
  message?: string;
  data?: unknown;
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: string;
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
}

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'next-heartbeat' | 'now';
  payload: CronPayload;
  delivery?: unknown;
  state: CronJobState;
}

export interface CronRunLogEntry {
  runId: string;
  jobId: string;
  startedAtMs: number;
  finishedAtMs?: number;
  status: string;
  error?: string;
  durationMs?: number;
}

export interface CronListResponse {
  jobs: CronJob[];
}

export interface CronRunsResponse {
  runs: CronRunLogEntry[];
}

export interface CronAddParams {
  name: string;
  agentId?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule: CronSchedule;
  sessionTarget?: 'main' | 'isolated';
  wakeMode?: 'next-heartbeat' | 'now';
  payload: CronPayload;
}

// ---- Store Types ----------------------------------------------------------

interface CronState {
  // Data
  jobs: CronJob[];
  runHistory: Record<string, CronRunLogEntry[]>;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadJobs: () => Promise<void>;
  addJob: (params: CronAddParams) => Promise<void>;
  updateJob: (id: string, patch: Partial<CronAddParams> & { enabled?: boolean }) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  triggerJob: (id: string) => Promise<void>;
  loadRuns: (id: string) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useCronStore = create<CronState>((set, get) => ({
  // Initial state
  jobs: [],
  runHistory: {},
  isLoading: false,
  error: null,

  loadJobs: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<CronListResponse>('cron.list');

      set({
        jobs: response.jobs ?? [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cron jobs';
      set({ error: errorMessage, isLoading: false });
      console.error('[Cron] Failed to load jobs:', err);
    }
  },

  addJob: async (params: CronAddParams) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.add', params);

      // Reload jobs list
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to add job:', err);
    }
  },

  updateJob: async (id: string, patch: Partial<CronAddParams> & { enabled?: boolean }) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.update', { id, ...patch });

      // Reload jobs list
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to update job:', err);
    }
  },

  removeJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.remove', { id });

      // Remove from local state immediately
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to remove job:', err);
    }
  },

  triggerJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.run', { id });

      // Reload jobs to get updated state
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger cron job';
      set({ error: errorMessage });
      console.error('[Cron] Failed to trigger job:', err);
    }
  },

  loadRuns: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      const response = await request<CronRunsResponse>('cron.runs', { id });

      set((state) => ({
        runHistory: {
          ...state.runHistory,
          [id]: response.runs ?? [],
        },
      }));
    } catch (err) {
      console.error('[Cron] Failed to load runs for job', id, ':', err);
    }
  },

  reset: () => {
    set({
      jobs: [],
      runHistory: {},
      isLoading: false,
      error: null,
    });
  },
}));
