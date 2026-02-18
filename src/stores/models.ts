// ---------------------------------------------------------------------------
// Models Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';

// ---- Model Types ----------------------------------------------------------

export interface ModelChoice {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

// ---- Store Types ----------------------------------------------------------

const MODELS_TTL_MS = 5 * 60_000; // 5 minutes

interface ModelsState {
  // Data
  models: ModelChoice[];
  currentModelId: string | null;
  lastFetchedAt: number | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadModels: (forceRefresh?: boolean) => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  currentModelId: null,
  lastFetchedAt: null,
  isLoading: false,
  error: null,

  loadModels: async (forceRefresh = false) => {
    const { lastFetchedAt } = get();
    if (!forceRefresh && lastFetchedAt !== null && Date.now() - lastFetchedAt < MODELS_TTL_MS) {
      return;
    }

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      // ModelsListResultSchema only has { models: [...] } — no `current` field.
      // Derive the current model from the connection snapshot's session defaults.
      const response = await request<{
        models: ModelChoice[];
      }>('models.list', {});

      // Derive the current model by fetching the main session
      const { useConnectionStore: connStore } = await import('./connection');
      const { snapshot, request: req2 } = connStore.getState();
      let currentModel: string | null = null;

      const mainKey = snapshot?.sessionDefaults?.mainSessionKey ?? 'main';
      try {
        const sessRes = await req2<{
          sessions: Array<{ key: string; model?: string }>;
        }>('sessions.list', { limit: 50 });
        const mainSession = (sessRes.sessions ?? []).find((s) => s.key === mainKey);
        if (mainSession?.model) {
          currentModel = mainSession.model;
        }
      } catch {
        // Non-critical — just won't highlight the current model
      }

      set({
        models: response.models ?? [],
        currentModelId: currentModel,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      console.error('[Models] Failed to load:', err);
    }
  },

  setModel: async (modelId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request, snapshot } = useConnectionStore.getState();

    try {
      set({ error: null });

      const mainSessionKey = snapshot?.sessionDefaults?.mainSessionKey ?? 'main';
      await request('sessions.patch', {
        key: mainSessionKey,
        model: modelId,
      });

      set({ currentModelId: modelId });
      toast.success('Default model updated');

      // Reload models to get fresh state
      get().loadModels(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set model';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Models] Failed to set model:', err);
      throw err;
    }
  },

  reset: () => {
    set({
      models: [],
      currentModelId: null,
      lastFetchedAt: null,
      isLoading: false,
      error: null,
    });
  },
}));
