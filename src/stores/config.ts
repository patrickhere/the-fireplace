// ---------------------------------------------------------------------------
// Config Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Types ----------------------------------------------------------------

export interface UiHint {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
}

export interface ConfigGetResponse {
  raw: string;
  hash: string;
}

export interface ConfigSchemaResponse {
  schema: unknown;
  uiHints: Record<string, UiHint>;
  version: string;
  generatedAt: string;
}

export interface ConfigApplyResponse {
  ok: boolean;
  hash?: string;
  error?: string;
}

// ---- Store Types ----------------------------------------------------------

interface ConfigState {
  // Data
  rawConfig: string | null;
  configHash: string | null;
  schema: unknown | null;
  uiHints: Record<string, UiHint>;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  loadConfig: () => Promise<void>;
  loadSchema: () => Promise<void>;
  saveConfig: (raw: string) => Promise<void>;
  patchConfig: (raw: string) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  rawConfig: null,
  configHash: null,
  schema: null,
  uiHints: {},
  isLoading: false,
  isSaving: false,
  error: null,

  loadConfig: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<ConfigGetResponse>('config.get');

      set({
        rawConfig: response.raw,
        configHash: response.hash,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load config';
      set({ error: errorMessage, isLoading: false });
      console.error('[Config] Failed to load config:', err);
    }
  },

  loadSchema: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      const response = await request<ConfigSchemaResponse>('config.schema');

      set({
        schema: response.schema,
        uiHints: response.uiHints ?? {},
      });
    } catch (err) {
      console.error('[Config] Failed to load schema:', err);
    }
  },

  saveConfig: async (raw: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();
    const { configHash } = get();

    try {
      set({ isSaving: true, error: null });

      const response = await request<ConfigApplyResponse>('config.apply', {
        raw,
        baseHash: configHash ?? undefined,
      });

      if (response.hash) {
        set({
          rawConfig: raw,
          configHash: response.hash,
          isSaving: false,
        });
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save config';
      set({ error: errorMessage, isSaving: false });
      console.error('[Config] Failed to save config:', err);
    }
  },

  patchConfig: async (raw: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();
    const { configHash } = get();

    try {
      set({ isSaving: true, error: null });

      await request('config.patch', {
        raw,
        baseHash: configHash ?? undefined,
      });

      set({ isSaving: false });

      // Reload config to get updated state
      get().loadConfig();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to patch config';
      set({ error: errorMessage, isSaving: false });
      console.error('[Config] Failed to patch config:', err);
    }
  },

  reset: () => {
    set({
      rawConfig: null,
      configHash: null,
      schema: null,
      uiHints: {},
      isLoading: false,
      isSaving: false,
      error: null,
    });
  },
}));
