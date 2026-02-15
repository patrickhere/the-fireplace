// ---------------------------------------------------------------------------
// Channels Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Channel Types --------------------------------------------------------

export interface ChannelAccount {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number;
  lastError?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  lastProbeAt?: number;
}

export interface ChannelStatusResponse {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channels: Record<string, unknown>;
  channelAccounts: Record<string, ChannelAccount[]>;
  channelDefaultAccountId: Record<string, string>;
}

// ---- Event Payload Types --------------------------------------------------

export interface ChannelEventPayload {
  channel: string;
  accountId?: string;
  type: 'connected' | 'disconnected' | 'error' | 'status';
  timestamp: number;
  error?: string;
}

// ---- Store Types ----------------------------------------------------------

interface ChannelsState {
  // Data
  channelStatus: ChannelStatusResponse | null;
  lastUpdate: number;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;
  pollInterval: ReturnType<typeof setInterval> | null;

  // Actions
  loadStatus: () => Promise<void>;
  logout: (channel: string, accountId?: string) => Promise<void>;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  // Initial state
  channelStatus: null,
  lastUpdate: 0,
  isLoading: false,
  error: null,
  eventUnsubscribe: null,
  pollInterval: null,

  loadStatus: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<ChannelStatusResponse>('channels.status', {
        probe: false,
      });

      set({
        channelStatus: response,
        lastUpdate: Date.now(),
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load channel status';
      set({ error: errorMessage, isLoading: false });
      console.error('[Channels] Failed to load status:', err);
    }
  },

  logout: async (channel: string, accountId?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('channels.logout', {
        channel,
        accountId,
      });

      // Reload status after logout
      get().loadStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      set({ error: errorMessage });
      console.error('[Channels] Failed to logout:', err);
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

      const unsub = subscribe<ChannelEventPayload>('channel', (payload) => {
        console.log('[Channels] Event received:', payload);

        // Reload status on any channel event
        if (['connected', 'disconnected', 'error', 'status'].includes(payload.type)) {
          get().loadStatus();
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

  startPolling: () => {
    const { pollInterval } = get();

    // Clear existing interval if any
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // Poll every 30 seconds
    const interval = setInterval(() => {
      get().loadStatus();
    }, 30000);

    set({ pollInterval: interval });
  },

  stopPolling: () => {
    const { pollInterval } = get();
    if (pollInterval) {
      clearInterval(pollInterval);
      set({ pollInterval: null });
    }
  },

  reset: () => {
    const { unsubscribeFromEvents, stopPolling } = get();
    unsubscribeFromEvents();
    stopPolling();
    set({
      channelStatus: null,
      lastUpdate: 0,
      isLoading: false,
      error: null,
      eventUnsubscribe: null,
      pollInterval: null,
    });
  },
}));
