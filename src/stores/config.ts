// ---------------------------------------------------------------------------
// Config Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Config Types ---------------------------------------------------------

export interface ConfigSchema {
  properties: Record<string, SchemaProperty>;
  required?: string[];
  description?: string;
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

// ---- Store Types ----------------------------------------------------------

interface ConfigState {
  // Data
  config: Record<string, unknown> | null;
  schema: ConfigSchema | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  showRawEditor: boolean;
  isDirty: boolean;
  draftConfig: Record<string, unknown> | null;

  // Actions
  loadConfig: () => Promise<void>;
  loadSchema: () => Promise<void>;
  setDraftConfig: (config: Record<string, unknown>) => void;
  updateDraftField: (path: string, value: unknown) => void;
  applyConfig: () => Promise<void>;
  resetDraft: () => void;
  setShowRawEditor: (show: boolean) => void;
  reset: () => void;
}

// ---- Helpers --------------------------------------------------------------

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) continue;
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    } else {
      current[key] = { ...current[key] };
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
  return result;
}

// ---- Store ----------------------------------------------------------------

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  schema: null,
  isLoading: false,
  error: null,
  showRawEditor: false,
  isDirty: false,
  draftConfig: null,

  loadConfig: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ config: Record<string, unknown> }>('config.get', {});

      set({
        config: response.config || {},
        draftConfig: response.config || {},
        isLoading: false,
        isDirty: false,
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
      set({ error: null });

      const response = await request<{ schema: ConfigSchema }>('config.schema', {});

      set({
        schema: response.schema || null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load config schema';
      set({ error: errorMessage });
      console.error('[Config] Failed to load schema:', err);
    }
  },

  setDraftConfig: (config: Record<string, unknown>) => {
    set({
      draftConfig: config,
      isDirty: JSON.stringify(config) !== JSON.stringify(get().config),
    });
  },

  updateDraftField: (path: string, value: unknown) => {
    const { draftConfig } = get();
    if (!draftConfig) return;

    const updated = setNestedValue(draftConfig, path, value);
    set({
      draftConfig: updated,
      isDirty: JSON.stringify(updated) !== JSON.stringify(get().config),
    });
  },

  applyConfig: async () => {
    const { draftConfig } = get();
    if (!draftConfig) return;

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      await request('config.apply', {
        config: draftConfig,
      });

      set({
        config: draftConfig,
        isLoading: false,
        isDirty: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply config';
      set({ error: errorMessage, isLoading: false });
      console.error('[Config] Failed to apply config:', err);
      throw err;
    }
  },

  resetDraft: () => {
    const { config } = get();
    set({
      draftConfig: config ? { ...config } : null,
      isDirty: false,
    });
  },

  setShowRawEditor: (show: boolean) => {
    set({ showRawEditor: show });
  },

  reset: () => {
    set({
      config: null,
      schema: null,
      isLoading: false,
      error: null,
      showRawEditor: false,
      isDirty: false,
      draftConfig: null,
    });
  },
}));
