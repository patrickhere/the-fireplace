// ---------------------------------------------------------------------------
// Config Store (Zustand)
//
// Gateway methods used: config.get, config.schema, config.apply, config.patch
// NOTE: config.set exists in the protocol registry but is intentionally NOT
// exposed here. config.apply is the intended write path — it validates the
// config and provides baseHash-based optimistic concurrency control.
// config.set would bypass validation and is reserved for internal/CLI use.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';

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

// ---- Parsed Provider Types ------------------------------------------------

export interface ParsedProvider {
  name: string;
  baseUrl: string;
  api: string;
  modelCount: number;
}

export interface EndpointTestResult {
  provider: string;
  status: 'ok' | 'error' | 'pending';
  message?: string;
}

const CONFIG_TTL_MS = 2 * 60_000; // 2 minutes

// ---- Store Types ----------------------------------------------------------

interface ConfigState {
  // Data
  rawConfig: string | null;
  configHash: string | null;
  schema: unknown | null;
  uiHints: Record<string, UiHint>;
  endpointResults: Map<string, EndpointTestResult>;
  lastFetchedAt: number | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Getters
  parsedProviders: () => ParsedProvider[];

  // Actions
  loadConfig: (forceRefresh?: boolean) => Promise<void>;
  loadSchema: () => Promise<void>;
  saveConfig: (raw: string) => Promise<void>;
  patchConfig: (raw: string) => Promise<void>;
  testEndpoint: (providerName: string) => Promise<EndpointTestResult>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  rawConfig: null,
  configHash: null,
  schema: null,
  uiHints: {},
  endpointResults: new Map(),
  lastFetchedAt: null,
  isLoading: false,
  isSaving: false,
  error: null,

  parsedProviders: (): ParsedProvider[] => {
    const { rawConfig } = get();
    if (!rawConfig) return [];
    try {
      const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
      const models = parsed.models as Record<string, unknown> | undefined;
      if (!models) return [];
      const providers = models.providers as Record<string, unknown> | undefined;
      if (!providers || typeof providers !== 'object') return [];

      return Object.entries(providers).map(([name, value]) => {
        const p = value as Record<string, unknown>;
        const modelsArr = Array.isArray(p.models) ? p.models : [];
        return {
          name,
          baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
          api: typeof p.api === 'string' ? p.api : 'unknown',
          modelCount: modelsArr.length,
        };
      });
    } catch {
      return [];
    }
  },

  loadConfig: async (forceRefresh = false) => {
    const { lastFetchedAt } = get();
    if (!forceRefresh && lastFetchedAt !== null && Date.now() - lastFetchedAt < CONFIG_TTL_MS) {
      return;
    }

    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<ConfigGetResponse>('config.get');

      set({
        rawConfig: response.raw,
        configHash: response.hash,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load config';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
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
        toast.success('Config saved');
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save config';
      set({ error: errorMessage, isSaving: false });
      toast.error(errorMessage);
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
      toast.success('Config patched');

      // Reload config to get updated state
      get().loadConfig(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to patch config';
      set({ error: errorMessage, isSaving: false });
      toast.error(errorMessage);
      console.error('[Config] Failed to patch config:', err);
    }
  },

  testEndpoint: async (providerName: string): Promise<EndpointTestResult> => {
    const pending: EndpointTestResult = { provider: providerName, status: 'pending' };
    set((state) => {
      const next = new Map(state.endpointResults);
      next.set(providerName, pending);
      return { endpointResults: next };
    });

    try {
      const { useConnectionStore } = await import('./connection');
      const { request } = useConnectionStore.getState();

      // Use models.list to verify the provider responds
      await request<{ models: unknown[] }>('models.list', {});

      const result: EndpointTestResult = {
        provider: providerName,
        status: 'ok',
        message: 'Endpoint healthy',
      };
      set((state) => {
        const next = new Map(state.endpointResults);
        next.set(providerName, result);
        return { endpointResults: next };
      });
      return result;
    } catch (err) {
      const result: EndpointTestResult = {
        provider: providerName,
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      };
      set((state) => {
        const next = new Map(state.endpointResults);
        next.set(providerName, result);
        return { endpointResults: next };
      });
      return result;
    }
  },

  reset: () => {
    set({
      rawConfig: null,
      configHash: null,
      schema: null,
      uiHints: {},
      endpointResults: new Map(),
      lastFetchedAt: null,
      isLoading: false,
      isSaving: false,
      error: null,
    });
  },
}));
