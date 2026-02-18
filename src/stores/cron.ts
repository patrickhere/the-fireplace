// ---------------------------------------------------------------------------
// Cron & Automation Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Unsubscribe } from '@/gateway/types';

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
  runId?: string;
  jobId: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  status: string;
  error?: string;
  durationMs?: number;
  runAtMs?: number;
  ts?: number;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
}

export interface CronListResponse {
  jobs: CronJob[];
}

export interface CronRunsResponse {
  runs?: CronRunLogEntry[];
  entries?: CronRunLogEntry[];
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

// ---- Cron Event Payload ---------------------------------------------------

/**
 * Payload shape for the `cron` gateway event.
 * The event fires when a job starts, completes, or fails.
 * All fields except `jobId` are optional — validate before use.
 */
interface CronEventPayload {
  jobId?: string;
  status?: string;
  error?: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  durationMs?: number;
  runningAtMs?: number;
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  consecutiveErrors?: number;
}

// ---- Store Types ----------------------------------------------------------

interface CronState {
  // Data
  jobs: CronJob[];
  runHistory: Record<string, CronRunLogEntry[]>;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Event subscription
  _eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadJobs: () => Promise<void>;
  addJob: (params: CronAddParams) => Promise<void>;
  updateJob: (id: string, patch: Partial<CronAddParams> & { enabled?: boolean }) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  triggerJob: (id: string) => Promise<void>;
  loadRuns: (id: string) => Promise<void>;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useCronStore = create<CronState>((set, get) => ({
  // Initial state
  jobs: [],
  runHistory: {},
  isLoading: false,
  error: null,
  _eventUnsubscribe: null,

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
      toast.error(errorMessage);
      console.error('[Cron] Failed to load jobs:', err);
    }
  },

  addJob: async (params: CronAddParams) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.add', params);

      toast.success('Cron job created');
      // Reload jobs list
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add cron job';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Cron] Failed to add job:', err);
    }
  },

  updateJob: async (id: string, patch: Partial<CronAddParams> & { enabled?: boolean }) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.update', { id, ...patch });

      toast.success('Cron job updated');
      // Reload jobs list
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cron job';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Cron] Failed to update job:', err);
    }
  },

  removeJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    // Optimistic remove
    const previous = get().jobs;
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }));

    try {
      set({ error: null });

      await request('cron.remove', { id });

      toast.success('Cron job deleted');
    } catch (err) {
      // Rollback on failure
      set({ jobs: previous });
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove cron job';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Cron] Failed to remove job:', err);
    }
  },

  triggerJob: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('cron.run', { id });

      toast.success('Cron job triggered');
      // Reload jobs to get updated state
      get().loadJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger cron job';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Cron] Failed to trigger job:', err);
    }
  },

  loadRuns: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      const response = await request<CronRunsResponse>('cron.runs', { id });
      const rows = response.entries ?? response.runs ?? [];

      set((state) => ({
        runHistory: {
          ...state.runHistory,
          [id]: rows,
        },
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load run history';
      toast.error(errMsg);
      console.error('[Cron] Failed to load runs for job', id, ':', err);
    }
  },

  subscribeToEvents: () => {
    const { _eventUnsubscribe } = get();
    if (_eventUnsubscribe) {
      _eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<CronEventPayload>('cron', (payload) => {
        // Validate payload has the minimum required field
        if (typeof payload !== 'object' || payload === null || typeof payload.jobId !== 'string') {
          console.warn('[Cron] Received malformed cron event, ignoring:', payload);
          return;
        }

        const {
          jobId,
          status,
          error,
          startedAtMs,
          finishedAtMs,
          durationMs,
          runningAtMs,
          nextRunAtMs,
          lastRunAtMs,
          consecutiveErrors,
        } = payload;

        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== jobId) return job;
            const stateUpdate: Partial<CronJobState> = {};
            if (status !== undefined) stateUpdate.lastStatus = status;
            if (error !== undefined) stateUpdate.lastError = error;
            if (startedAtMs !== undefined || runningAtMs !== undefined)
              stateUpdate.runningAtMs = runningAtMs ?? startedAtMs;
            if (finishedAtMs !== undefined || lastRunAtMs !== undefined)
              stateUpdate.lastRunAtMs = lastRunAtMs ?? finishedAtMs;
            if (durationMs !== undefined) stateUpdate.lastDurationMs = durationMs;
            if (nextRunAtMs !== undefined) stateUpdate.nextRunAtMs = nextRunAtMs;
            if (consecutiveErrors !== undefined) stateUpdate.consecutiveErrors = consecutiveErrors;
            // Clear runningAtMs once finished
            if (finishedAtMs !== undefined || lastRunAtMs !== undefined)
              stateUpdate.runningAtMs = undefined;
            return { ...job, state: { ...job.state, ...stateUpdate } };
          }),
        }));
      });

      set({ _eventUnsubscribe: unsub });
    })();
  },

  unsubscribeFromEvents: () => {
    const { _eventUnsubscribe } = get();
    if (_eventUnsubscribe) {
      _eventUnsubscribe();
      set({ _eventUnsubscribe: null });
    }
  },

  reset: () => {
    get().unsubscribeFromEvents();
    set({
      jobs: [],
      runHistory: {},
      isLoading: false,
      error: null,
      _eventUnsubscribe: null,
    });
  },
}));
