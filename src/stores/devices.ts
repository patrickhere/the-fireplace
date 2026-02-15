// ---------------------------------------------------------------------------
// Devices Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Device Types ---------------------------------------------------------

export interface Device {
  id: string;
  name: string;
  publicKey: string;
  paired: boolean;
  pairedAt?: number;
  lastSeen?: number;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  scopes?: string[];
  role?: string;
  token?: string;
  metadata?: Record<string, unknown>;
}

export interface PairingRequest {
  id: string;
  deviceId: string;
  deviceName?: string;
  publicKey: string;
  requestedAt: number;
  expiresAt?: number;
  platform?: string;
  deviceFamily?: string;
}

// ---- Event Payload Types --------------------------------------------------

export interface DevicePairingRequestPayload {
  id: string;
  deviceId: string;
  deviceName?: string;
  publicKey: string;
  timestamp: number;
  platform?: string;
}

export interface DevicePairedPayload {
  deviceId: string;
  timestamp: number;
}

// ---- Store Types ----------------------------------------------------------

interface DevicesState {
  // Data
  devices: Device[];
  pairingRequests: PairingRequest[];
  selectedDevice: Device | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  showPairingModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadDevices: () => Promise<void>;
  loadPairingRequests: () => Promise<void>;
  approvePairing: (id: string) => Promise<void>;
  rejectPairing: (id: string, reason?: string) => Promise<void>;
  unpairDevice: (deviceId: string) => Promise<void>;
  rotateToken: (deviceId: string) => Promise<void>;
  revokeToken: (deviceId: string) => Promise<void>;
  renameDevice: (deviceId: string, name: string) => Promise<void>;
  setSelectedDevice: (device: Device | null) => void;
  setShowPairingModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useDevicesStore = create<DevicesState>((set, get) => ({
  // Initial state
  devices: [],
  pairingRequests: [],
  selectedDevice: null,
  isLoading: false,
  error: null,
  showPairingModal: false,
  eventUnsubscribe: null,

  loadDevices: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ devices: Device[] }>('device.list', {
        includePaired: true,
      });

      set({
        devices: response.devices || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load devices';
      set({ error: errorMessage, isLoading: false });
      console.error('[Devices] Failed to load devices:', err);
    }
  },

  loadPairingRequests: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ requests: PairingRequest[] }>('device.pair.list', {
        status: 'pending',
      });

      set({
        pairingRequests: response.requests || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load pairing requests';
      set({ error: errorMessage });
      console.error('[Devices] Failed to load pairing requests:', err);
    }
  },

  approvePairing: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.pair.approve', {
        id,
      });

      // Remove from pending requests
      set((state) => ({
        pairingRequests: state.pairingRequests.filter((req) => req.id !== id),
      }));

      // Reload devices
      get().loadDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve pairing';
      set({ error: errorMessage });
      console.error('[Devices] Failed to approve pairing:', err);
    }
  },

  rejectPairing: async (id: string, reason?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.pair.reject', {
        id,
        reason,
      });

      // Remove from pending requests
      set((state) => ({
        pairingRequests: state.pairingRequests.filter((req) => req.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject pairing';
      set({ error: errorMessage });
      console.error('[Devices] Failed to reject pairing:', err);
    }
  },

  unpairDevice: async (deviceId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.unpair', {
        deviceId,
      });

      // Remove from local state
      set((state) => ({
        devices: state.devices.filter((device) => device.id !== deviceId),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unpair device';
      set({ error: errorMessage });
      console.error('[Devices] Failed to unpair device:', err);
    }
  },

  rotateToken: async (deviceId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.token.rotate', {
        deviceId,
      });

      // Reload devices
      get().loadDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rotate token';
      set({ error: errorMessage });
      console.error('[Devices] Failed to rotate token:', err);
    }
  },

  revokeToken: async (deviceId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.token.revoke', {
        deviceId,
      });

      // Reload devices
      get().loadDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke token';
      set({ error: errorMessage });
      console.error('[Devices] Failed to revoke token:', err);
    }
  },

  renameDevice: async (deviceId: string, name: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('device.rename', {
        deviceId,
        name,
      });

      // Update local state
      set((state) => ({
        devices: state.devices.map((device) =>
          device.id === deviceId ? { ...device, name } : device
        ),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename device';
      set({ error: errorMessage });
      console.error('[Devices] Failed to rename device:', err);
    }
  },

  setSelectedDevice: (device: Device | null) => {
    set({ selectedDevice: device });
  },

  setShowPairingModal: (show: boolean) => {
    set({ showPairingModal: show });
    if (show && get().pairingRequests.length === 0) {
      get().loadPairingRequests();
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

      // Subscribe to pairing request events
      const unsub1 = subscribe<DevicePairingRequestPayload>('device.pair.requested', (payload) => {
        console.log('[Devices] Pairing request:', payload);

        const newRequest: PairingRequest = {
          id: payload.id,
          deviceId: payload.deviceId,
          deviceName: payload.deviceName,
          publicKey: payload.publicKey,
          requestedAt: payload.timestamp,
          platform: payload.platform,
        };

        set((state) => ({
          pairingRequests: [newRequest, ...state.pairingRequests],
        }));
      });

      // Subscribe to device paired events
      const unsub2 = subscribe<DevicePairedPayload>('device.paired', (payload) => {
        console.log('[Devices] Device paired:', payload);

        // Reload devices
        get().loadDevices();
      });

      set({
        eventUnsubscribe: () => {
          unsub1();
          unsub2();
        },
      });
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
    const { unsubscribeFromEvents } = get();
    unsubscribeFromEvents();
    set({
      devices: [],
      pairingRequests: [],
      selectedDevice: null,
      isLoading: false,
      error: null,
      showPairingModal: false,
      eventUnsubscribe: null,
    });
  },
}));
