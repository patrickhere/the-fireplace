// ---------------------------------------------------------------------------
// Logs Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Log Types ------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<
    string,
    {
      status: 'pass' | 'warn' | 'fail';
      message?: string;
      lastCheck?: number;
    }
  >;
  lastUpdated: number;
}

// ---- Event Payload Types --------------------------------------------------

export interface LogEventPayload {
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ---- Store Types ----------------------------------------------------------

interface LogsState {
  // Data
  logs: LogEntry[];
  health: HealthStatus | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  isTailing: boolean;
  autoScroll: boolean;
  maxLogs: number;

  // Filters
  levelFilter: LogLevel | 'all';
  sourceFilter: string;
  searchQuery: string;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadHistory: (limit?: number) => Promise<void>;
  loadHealth: () => Promise<void>;
  startTailing: () => void;
  stopTailing: () => void;
  clearLogs: () => void;
  setLevelFilter: (level: LogLevel | 'all') => void;
  setSourceFilter: (source: string) => void;
  setSearchQuery: (query: string) => void;
  setAutoScroll: (enabled: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Helpers --------------------------------------------------------------

function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ---- Store ----------------------------------------------------------------

export const useLogsStore = create<LogsState>((set, get) => ({
  // Initial state
  logs: [],
  health: null,
  isLoading: false,
  error: null,
  isTailing: false,
  autoScroll: true,
  maxLogs: 1000,
  levelFilter: 'all',
  sourceFilter: '',
  searchQuery: '',
  eventUnsubscribe: null,

  loadHistory: async (limit = 100) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ logs: LogEntry[] }>('logs.history', {
        limit,
      });

      set({
        logs: response.logs || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load log history';
      set({ error: errorMessage, isLoading: false });
      console.error('[Logs] Failed to load history:', err);
    }
  },

  loadHealth: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<HealthStatus>('health.status', {});

      set({
        health: response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load health status';
      set({ error: errorMessage });
      console.error('[Logs] Failed to load health:', err);
    }
  },

  startTailing: () => {
    if (get().isTailing) return;

    set({ isTailing: true });
    get().subscribeToEvents();
  },

  stopTailing: () => {
    set({ isTailing: false });
    get().unsubscribeFromEvents();
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  setLevelFilter: (level: LogLevel | 'all') => {
    set({ levelFilter: level });
  },

  setSourceFilter: (source: string) => {
    set({ sourceFilter: source });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setAutoScroll: (enabled: boolean) => {
    set({ autoScroll: enabled });
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<LogEventPayload>('log', (payload) => {
        const { maxLogs } = get();

        const newLog: LogEntry = {
          id: generateLogId(),
          timestamp: payload.timestamp,
          level: payload.level,
          source: payload.source,
          message: payload.message,
          metadata: payload.metadata,
        };

        set((state) => {
          const updatedLogs = [newLog, ...state.logs];
          // Keep only the most recent maxLogs entries
          if (updatedLogs.length > maxLogs) {
            updatedLogs.splice(maxLogs);
          }
          return { logs: updatedLogs };
        });
      });

      set({ eventUnsubscribe: unsub });
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
      logs: [],
      health: null,
      isLoading: false,
      error: null,
      isTailing: false,
      autoScroll: true,
      maxLogs: 1000,
      levelFilter: 'all',
      sourceFilter: '',
      searchQuery: '',
      eventUnsubscribe: null,
    });
  },
}));
