// ---------------------------------------------------------------------------
// Sessions Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Unsubscribe } from '@/gateway/types';
import { optimisticMutation } from '@/lib/optimistic';

// ---- Session Types --------------------------------------------------------

export interface SessionListItem {
  key: string;
  label?: string;
  model?: string;
  messageCount?: number;
  lastActive?: number;
  agentId?: string;
  spawnedBy?: string;
  derivedTitle?: string;
  lastMessage?: string;
}

export interface SessionPreview {
  key: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  messageCount: number;
}

export interface SessionConfig {
  label?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  responseUsage?: 'off' | 'tokens' | 'full' | 'on' | null;
  elevatedLevel?: string | null;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
  execNode?: string | null;
  spawnedBy?: string | null;
  sendPolicy?: 'allow' | 'deny' | null;
  groupActivation?: 'mention' | 'always' | null;
}

export interface SessionUsageData {
  sessions: Array<{
    key: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    messageCount: number;
    model?: string;
  }>;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ---- Event Payload Types --------------------------------------------------

export interface SessionEventPayload {
  sessionKey: string;
  type: 'created' | 'updated' | 'deleted' | 'reset';
  timestamp: number;
}

// ---- Store Types ----------------------------------------------------------

interface SessionsState {
  // Data
  sessions: SessionListItem[];
  selectedSession: SessionPreview | null;
  usageStats: SessionUsageData | null;

  // UI State
  searchQuery: string;
  activeFilter: 'all' | 'recent' | 'labeled';
  isLoading: boolean;
  error: string | null;
  showPreviewModal: boolean;
  showConfigModal: boolean;
  showUsageModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;
  _reloadTimer: ReturnType<typeof setTimeout> | null;

  // Internal helpers
  _scheduledReload: () => void;

  // Actions
  loadSessions: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: 'all' | 'recent' | 'labeled') => void;
  previewSession: (key: string) => Promise<void>;
  patchSession: (key: string, config: Partial<SessionConfig>) => Promise<void>;
  resetSession: (key: string) => Promise<void>;
  deleteSession: (key: string, deleteTranscript: boolean) => Promise<void>;
  compactSession: (key: string) => Promise<void>;
  loadUsage: (key?: string) => Promise<void>;
  setShowPreviewModal: (show: boolean) => void;
  setShowConfigModal: (show: boolean) => void;
  setShowUsageModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useSessionsStore = create<SessionsState>((set, get) => ({
  // Initial state
  sessions: [],
  selectedSession: null,
  usageStats: null,
  searchQuery: '',
  activeFilter: 'all',
  isLoading: false,
  error: null,
  showPreviewModal: false,
  showConfigModal: false,
  showUsageModal: false,
  eventUnsubscribe: null,
  _reloadTimer: null,

  _scheduledReload: () => {
    const { _reloadTimer } = get();
    if (_reloadTimer) clearTimeout(_reloadTimer);
    const timer = setTimeout(() => {
      get().loadSessions();
      set({ _reloadTimer: null });
    }, 500);
    set({ _reloadTimer: timer });
  },

  loadSessions: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ sessions: SessionListItem[] }>('sessions.list', {
        limit: 200,
        includeDerivedTitles: true,
        includeLastMessage: true,
        includeGlobal: true,
        includeUnknown: true,
      });

      set({
        sessions: response.sessions || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to load sessions:', err);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilter: (filter: 'all' | 'recent' | 'labeled') => {
    set({ activeFilter: filter });
  },

  previewSession: async (key: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<
        SessionPreview | { sessions?: SessionPreview[]; previews?: SessionPreview[] }
      >('sessions.preview', {
        keys: [key],
        limit: 100,
        maxChars: 50000,
      });

      // sessions.preview returns an array result — unwrap defensively
      let preview: SessionPreview | null = null;
      if (response && typeof response === 'object') {
        if ('sessions' in response && Array.isArray(response.sessions)) {
          preview = response.sessions.find((s) => s.key === key) ?? response.sessions[0] ?? null;
        } else if ('previews' in response && Array.isArray(response.previews)) {
          preview = response.previews.find((s) => s.key === key) ?? response.previews[0] ?? null;
        } else if ('key' in response) {
          // Already a direct SessionPreview shape
          preview = response as SessionPreview;
        }
      }

      set({ selectedSession: preview, showPreviewModal: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview session';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to preview session:', err);
    }
  },

  patchSession: async (key: string, config: Partial<SessionConfig>) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('sessions.patch', {
        key,
        ...config,
      });

      toast.success('Session updated');
      // Reload sessions to reflect changes
      get().loadSessions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update session';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to patch session:', err);
    }
  },

  resetSession: async (key: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('sessions.reset', {
        key,
        reason: 'reset',
      });

      toast.success('Session reset');
      // Reload sessions to reflect changes
      get().loadSessions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset session';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to reset session:', err);
    }
  },

  deleteSession: async (key: string, deleteTranscript: boolean) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await optimisticMutation(get, (partial) => set(partial), {
        snapshot: (state) => ({ sessions: state.sessions }),
        apply: (state) => ({ sessions: state.sessions.filter((s) => s.key !== key) }),
        execute: () =>
          request('sessions.delete', {
            key,
            deleteTranscript,
          }),
        errorMessage: 'Failed to delete session',
      });

      toast.success('Session deleted');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      set({ error: errorMessage });
      console.error('[Sessions] Failed to delete session:', err);
    }
  },

  compactSession: async (key: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('sessions.compact', {
        key,
        maxLines: 1000,
      });

      toast.success('Session compacted');
      // Reload sessions to reflect changes
      get().loadSessions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compact session';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to compact session:', err);
    }
  },

  loadUsage: async (key?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<SessionUsageData>('sessions.usage', {
        key,
        limit: 50,
        includeContextWeight: true,
      });

      set({ usageStats: response, showUsageModal: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage stats';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Sessions] Failed to load usage:', err);
    }
  },

  setShowPreviewModal: (show: boolean) => {
    set({ showPreviewModal: show });
    if (!show) {
      set({ selectedSession: null });
    }
  },

  setShowConfigModal: (show: boolean) => {
    set({ showConfigModal: show });
  },

  setShowUsageModal: (show: boolean) => {
    set({ showUsageModal: show });
    if (!show) {
      set({ usageStats: null });
    }
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<SessionEventPayload>('session', (payload) => {
        console.log('[Sessions] Event received:', payload);

        // Debounced reload — prevents burst requests when many session events arrive quickly
        if (['created', 'updated', 'deleted', 'reset'].includes(payload.type)) {
          get()._scheduledReload();
        }
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
    const { unsubscribeFromEvents, _reloadTimer } = get();
    unsubscribeFromEvents();
    if (_reloadTimer) clearTimeout(_reloadTimer);
    set({
      sessions: [],
      selectedSession: null,
      usageStats: null,
      searchQuery: '',
      activeFilter: 'all',
      isLoading: false,
      error: null,
      showPreviewModal: false,
      showConfigModal: false,
      showUsageModal: false,
      eventUnsubscribe: null,
      _reloadTimer: null,
    });
  },
}));
