// ---------------------------------------------------------------------------
// Models Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Model Types ----------------------------------------------------------

export interface ModelChoice {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

// ---- Store Types ----------------------------------------------------------

interface ModelsState {
  // Data
  models: ModelChoice[];
  currentModelId: string | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadModels: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  currentModelId: null,
  isLoading: false,
  error: null,

  loadModels: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        models: ModelChoice[];
        current?: string;
      }>('models.list', {});

      set({
        models: response.models ?? [],
        currentModelId: response.current ?? null,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      set({ error: errorMessage, isLoading: false });
      console.error('[Models] Failed to load:', err);
    }
  },

  setModel: async (modelId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('model.set', { model: modelId });

      set({ currentModelId: modelId });

      // Reload models to get fresh state
      get().loadModels();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set model';
      set({ error: errorMessage });
      console.error('[Models] Failed to set model:', err);
    }
  },

  reset: () => {
    set({
      models: [],
      currentModelId: null,
      isLoading: false,
      error: null,
    });
  },
}));
