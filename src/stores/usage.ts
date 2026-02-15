// ---------------------------------------------------------------------------
// Usage Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Usage Types ----------------------------------------------------------

export interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  activeSessions: number;
}

export interface SessionUsageEntry {
  sessionKey: string;
  name: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastActivity: number;
}

// ---- Store Types ----------------------------------------------------------

interface UsageState {
  // Data
  usage: UsageData | null;
  sessionUsage: SessionUsageEntry[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadUsage: () => Promise<void>;
  loadSessionUsage: () => Promise<void>;
  loadAll: () => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useUsageStore = create<UsageState>((set) => ({
  usage: null,
  sessionUsage: [],
  isLoading: false,
  error: null,

  loadUsage: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        totalInputTokens?: number;
        totalOutputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
        activeSessions?: number;
      }>('sessions.usage', {});

      set({
        usage: {
          totalInputTokens: response.totalInputTokens ?? 0,
          totalOutputTokens: response.totalOutputTokens ?? 0,
          totalTokens: response.totalTokens ?? 0,
          estimatedCostUsd: response.estimatedCostUsd ?? 0,
          activeSessions: response.activeSessions ?? 0,
        },
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load:', err);
    }
  },

  loadSessionUsage: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        sessions: Array<{
          sessionKey: string;
          name?: string;
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          lastActivity?: number;
          ts?: number;
        }>;
      }>('sessions.list', {});

      const sessions = response.sessions ?? [];

      const sessionUsage: SessionUsageEntry[] = sessions
        .map((s) => ({
          sessionKey: s.sessionKey,
          name: s.name ?? s.sessionKey,
          model: s.model ?? 'unknown',
          inputTokens: s.inputTokens ?? 0,
          outputTokens: s.outputTokens ?? 0,
          totalTokens: s.totalTokens ?? (s.inputTokens ?? 0) + (s.outputTokens ?? 0),
          lastActivity: s.lastActivity ?? s.ts ?? 0,
        }))
        .sort((a, b) => b.totalTokens - a.totalTokens);

      set({ sessionUsage, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session usage';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load session usage:', err);
    }
  },

  loadAll: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      // Load both in parallel
      const [usageRes, sessionsRes] = await Promise.all([
        request<{
          totalInputTokens?: number;
          totalOutputTokens?: number;
          totalTokens?: number;
          estimatedCostUsd?: number;
          activeSessions?: number;
        }>('sessions.usage', {}),
        request<{
          sessions: Array<{
            sessionKey: string;
            name?: string;
            model?: string;
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
            lastActivity?: number;
            ts?: number;
          }>;
        }>('sessions.list', {}),
      ]);

      const sessions = sessionsRes.sessions ?? [];

      const sessionUsage: SessionUsageEntry[] = sessions
        .map((s) => ({
          sessionKey: s.sessionKey,
          name: s.name ?? s.sessionKey,
          model: s.model ?? 'unknown',
          inputTokens: s.inputTokens ?? 0,
          outputTokens: s.outputTokens ?? 0,
          totalTokens: s.totalTokens ?? (s.inputTokens ?? 0) + (s.outputTokens ?? 0),
          lastActivity: s.lastActivity ?? s.ts ?? 0,
        }))
        .sort((a, b) => b.totalTokens - a.totalTokens);

      set({
        usage: {
          totalInputTokens: usageRes.totalInputTokens ?? 0,
          totalOutputTokens: usageRes.totalOutputTokens ?? 0,
          totalTokens: usageRes.totalTokens ?? 0,
          estimatedCostUsd: usageRes.estimatedCostUsd ?? 0,
          activeSessions: usageRes.activeSessions ?? 0,
        },
        sessionUsage,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage data';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load all:', err);
    }
  },

  reset: () => {
    set({
      usage: null,
      sessionUsage: [],
      isLoading: false,
      error: null,
    });
  },
}));
