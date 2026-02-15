// ---------------------------------------------------------------------------
// Devices Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Device Types ---------------------------------------------------------

export interface DevicePairRequest {
  requestId: string;
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
}

export interface DevicePairResolvedEvent {
  requestId: string;
  deviceId: string;
  decision: string;
  ts: number;
}

export interface PairedDevice {
  deviceId: string;
  displayName?: string;
  platform?: string;
  role: string;
  scopes?: string[];
  lastSeen?: number;
  publicKey?: string;
}

// ---- Store Types ----------------------------------------------------------

interface DevicesState {
  // Data
  pairingRequests: DevicePairRequest[];
  pairedDevices: PairedDevice[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Event subscriptions
  eventUnsubscribes: Unsubscribe[];

  // Actions
  loadRequests: () => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  rotateToken: (deviceId: string, role: string, scopes?: string[]) => Promise<void>;
  revokeToken: (deviceId: string, role: string) => Promise<void>;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useDevicesStore = create<DevicesState>((set, get) => ({
  pairingRequests: [],
  pairedDevices: [],
  isLoading: false,
  error: null,
  eventUnsubscribes: [],

  loadRequests: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        requests: DevicePairRequest[];
        devices?: PairedDevice[];
      }>('device.pair.list', {});

      set({
        pairingRequests: response.requests ?? [],
        pairedDevices: response.devices ?? [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load device requests';
      set({ error: errorMessage, isLoading: false });
      console.error('[Devices] Failed to load requests:', err);
    }
  },

  approveRequest: async (requestId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });
      await request('device.pair.approve', { requestId });
      get().loadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve request';
      set({ error: errorMessage });
      console.error('[Devices] Failed to approve:', err);
    }
  },

  rejectRequest: async (requestId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });
      await request('device.pair.reject', { requestId });
      get().loadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject request';
      set({ error: errorMessage });
      console.error('[Devices] Failed to reject:', err);
    }
  },

  rotateToken: async (deviceId: string, role: string, scopes?: string[]) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });
      await request('device.token.rotate', { deviceId, role, scopes });
      get().loadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rotate token';
      set({ error: errorMessage });
      console.error('[Devices] Failed to rotate token:', err);
    }
  },

  revokeToken: async (deviceId: string, role: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });
      await request('device.token.revoke', { deviceId, role });
      get().loadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke token';
      set({ error: errorMessage });
      console.error('[Devices] Failed to revoke token:', err);
    }
  },

  subscribeToEvents: () => {
    const { eventUnsubscribes } = get();

    // Clean up existing subscriptions
    for (const unsub of eventUnsubscribes) {
      unsub();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub1 = subscribe<DevicePairRequest>('device.pair.requested', (payload) => {
        console.log('[Devices] Pair request received:', payload);
        set((state) => ({
          pairingRequests: [...state.pairingRequests, payload],
        }));
      });

      const unsub2 = subscribe<DevicePairResolvedEvent>('device.pair.resolved', (payload) => {
        console.log('[Devices] Pair resolved:', payload);
        set((state) => ({
          pairingRequests: state.pairingRequests.filter((r) => r.requestId !== payload.requestId),
        }));
      });

      set({ eventUnsubscribes: [unsub1, unsub2] });
    })();
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribes } = get();
    for (const unsub of eventUnsubscribes) {
      unsub();
    }
    set({ eventUnsubscribes: [] });
  },

  reset: () => {
    get().unsubscribeFromEvents();
    set({
      pairingRequests: [],
      pairedDevices: [],
      isLoading: false,
      error: null,
      eventUnsubscribes: [],
    });
  },
}));
