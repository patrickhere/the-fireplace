// ---------------------------------------------------------------------------
// Logs & Debug Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Constants ------------------------------------------------------------

const MAX_LINES = 10_000;

// ---- Types ----------------------------------------------------------------

export interface LogsTailResponse {
  file: string;
  cursor: number;
  size: number;
  lines: string[];
  truncated?: boolean;
  reset?: boolean;
}

export interface DebugResult {
  ok: boolean;
  payload?: unknown;
  error?: string;
  durationMs: number;
}

// ---- Store Types ----------------------------------------------------------

interface LogsState {
  // Data
  lines: string[];
  fileName: string | null;
  cursor: number;
  fileSize: number;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Tailing
  isTailing: boolean;
  tailInterval: ReturnType<typeof setInterval> | null;

  // Debug
  lastDebugResult: DebugResult | null;
  isDebugLoading: boolean;

  // Actions
  fetchLogs: (cursor?: number) => Promise<void>;
  startTailing: () => void;
  stopTailing: () => void;
  clearLogs: () => void;
  callMethod: (method: string, params?: unknown) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useLogsStore = create<LogsState>((set, get) => ({
  // Initial state
  lines: [],
  fileName: null,
  cursor: 0,
  fileSize: 0,
  isLoading: false,
  error: null,
  isTailing: false,
  tailInterval: null,
  lastDebugResult: null,
  isDebugLoading: false,

  fetchLogs: async (cursorOverride?: number) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();
    const { cursor: currentCursor } = get();

    try {
      set({ isLoading: true, error: null });

      const response = await request<LogsTailResponse>('logs.tail', {
        cursor: cursorOverride ?? currentCursor,
        limit: 500,
      });

      if (response.reset) {
        // Log file was rotated, replace all lines
        set({
          lines: response.lines,
          cursor: response.cursor,
          fileName: response.file,
          fileSize: response.size,
          isLoading: false,
        });
      } else {
        // Append new lines, capped to MAX_LINES
        set((state) => ({
          lines: [...state.lines, ...response.lines].slice(-MAX_LINES),
          cursor: response.cursor,
          fileName: response.file,
          fileSize: response.size,
          isLoading: false,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs';
      set({ error: errorMessage, isLoading: false });
      console.error('[Logs] Failed to fetch logs:', err);
    }
  },

  startTailing: () => {
    const { tailInterval } = get();

    // Clear existing interval
    if (tailInterval) {
      clearInterval(tailInterval);
    }

    // Fetch immediately, then poll every 2s
    get().fetchLogs();

    const interval = setInterval(() => {
      get().fetchLogs();
    }, 2000);

    set({ isTailing: true, tailInterval: interval });
  },

  stopTailing: () => {
    const { tailInterval } = get();
    if (tailInterval) {
      clearInterval(tailInterval);
    }
    set({ isTailing: false, tailInterval: null });
  },

  clearLogs: () => {
    set({ lines: [], cursor: 0 });
  },

  callMethod: async (method: string, params?: unknown) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    const startMs = Date.now();

    try {
      set({ isDebugLoading: true, lastDebugResult: null });

      const payload = await request<unknown>(method, params ?? undefined);
      const durationMs = Date.now() - startMs;

      set({
        lastDebugResult: { ok: true, payload, durationMs },
        isDebugLoading: false,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const errorMessage = err instanceof Error ? err.message : 'Request failed';

      set({
        lastDebugResult: { ok: false, error: errorMessage, durationMs },
        isDebugLoading: false,
      });
    }
  },

  reset: () => {
    const { stopTailing } = get();
    stopTailing();
    set({
      lines: [],
      fileName: null,
      cursor: 0,
      fileSize: 0,
      isLoading: false,
      error: null,
      isTailing: false,
      tailInterval: null,
      lastDebugResult: null,
      isDebugLoading: false,
    });
  },
}));
