// ---------------------------------------------------------------------------
// Gateway Connection Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { GatewayClient } from '@/gateway/client';
import type {
  GatewayConnectionState,
  GatewayPolicy,
  StateVersion,
  Snapshot,
  HelloOkFeatures,
  HelloOkAuth,
  EventHandler,
  EventFrame,
  Unsubscribe,
  RequestOptions,
  PresenceEntry,
} from '@/gateway/types';
import { buildClientInfo, getDeviceId } from '@/gateway/protocol';
import { deleteDeviceToken } from '@/lib/keychain';

// ---- Store Types ----------------------------------------------------------

interface ServerInfo {
  version: string | null;
  connId: string | null;
  commit: string | null;
  host: string | null;
  protocol: number;
  features: HelloOkFeatures;
  policy: GatewayPolicy | null;
}

// ---- Presence Event Payload -----------------------------------------------

/**
 * Payload shape for the `presence` gateway event.
 * Carries a delta or a full replacement of the presence list.
 */
interface PresenceEventPayload {
  /** Full replacement list (server pushes all connected clients). */
  presence?: PresenceEntry[];
  /** A single entry that joined. */
  joined?: PresenceEntry;
  /** instanceId of the client that left. */
  left?: string;
}

// ---------------------------------------------------------------------------

interface ConnectionState {
  // -- Reactive state (drives UI)
  status: GatewayConnectionState;
  serverInfo: ServerInfo | null;
  snapshot: Snapshot | null;
  stateVersion: StateVersion;
  auth: HelloOkAuth | null;
  error: string | null;
  gatewayUrl: string;
  reconnectAttempt: number;
  /** Gateway server version string (e.g. "2026.1.29"), null until connected. */
  gatewayVersion: string | null;
  /** Live presence list — updated by presence events after initial connect. */
  presence: PresenceEntry[];

  // -- Client instance (not serializable, kept as a ref)
  client: GatewayClient | null;

  // -- Presence subscription (internal ref)
  _presenceUnsub: Unsubscribe | null;

  // -- Actions
  setGatewayUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  destroy: () => void;
  clearDeviceToken: () => Promise<void>;

  // -- Request forwarding
  request: <T = unknown>(method: string, params?: unknown, options?: RequestOptions) => Promise<T>;

  // -- Event forwarding
  subscribe: <T = unknown>(event: string, handler: EventHandler<T>) => Unsubscribe;
  subscribeAll: (handler: EventHandler<EventFrame>) => Unsubscribe;
}

// ---- Default Gateway URL --------------------------------------------------

const DEFAULT_GATEWAY_URL = 'wss://patricks-macmini.pangolin-typhon.ts.net/';

// ---- Noop unsubscribe (returned when client is not connected) -------------

const NOOP_UNSUBSCRIBE: Unsubscribe = () => {
  /* no-op */
};

// ---- Store ----------------------------------------------------------------

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'disconnected',
  serverInfo: null,
  snapshot: null,
  stateVersion: { presence: 0, health: 0 },
  auth: null,
  error: null,
  gatewayUrl: DEFAULT_GATEWAY_URL,
  reconnectAttempt: 0,
  gatewayVersion: null,
  presence: [],
  client: null,
  _presenceUnsub: null,

  setGatewayUrl: (url: string) => {
    set({ gatewayUrl: url });
  },

  connect: async () => {
    const { gatewayUrl, client: existingClient } = get();

    // Tear down any existing client
    if (existingClient) {
      existingClient.destroy();
    }

    set({ error: null, status: 'connecting' });

    const clientInfo = buildClientInfo();

    const client = new GatewayClient({
      url: gatewayUrl,
      clientInfo,
    });

    // Sync state changes into Zustand
    client.onStateChange((newState) => {
      const update: Partial<ConnectionState> = { status: newState };

      if (newState === 'error') {
        const lastErr = client.lastError;
        update.error = lastErr ? `${lastErr.code}: ${lastErr.message}` : 'Connection failed';
      }

      if (newState === 'connected') {
        update.error = null;
        update.reconnectAttempt = 0;
        const si = client.serverInfo;
        update.serverInfo = {
          version: si?.version ?? null,
          connId: si?.connId ?? null,
          commit: si?.commit ?? null,
          host: si?.host ?? null,
          protocol: client.serverProtocol ?? 3,
          features: client.serverFeatures ?? { methods: [], events: [] },
          policy: client.serverPolicy,
        };
        update.snapshot = client.snapshot;
        update.stateVersion = client.stateVersion;
        update.auth = client.auth;
        update.gatewayVersion = si?.version ?? null;
        // Seed presence list from snapshot
        update.presence = (client.snapshot?.presence ?? []) as PresenceEntry[];

        // Subscribe to presence events for live updates (unsubscribe previous if any)
        const prevPresenceUnsub = get()._presenceUnsub;
        if (prevPresenceUnsub) prevPresenceUnsub();
        const presenceUnsub = client.on<PresenceEventPayload>('presence', (payload) => {
          if (typeof payload !== 'object' || payload === null) return;
          set((state) => {
            if (Array.isArray((payload as PresenceEventPayload).presence)) {
              // Full replacement
              return { presence: (payload as PresenceEventPayload).presence! };
            }
            const joined = (payload as PresenceEventPayload).joined;
            const left = (payload as PresenceEventPayload).left;
            let updated = [...state.presence];
            if (joined) {
              // Replace existing entry with same instanceId or append
              const idx = updated.findIndex((p) => p.instanceId === joined.instanceId);
              if (idx >= 0) {
                updated[idx] = joined;
              } else {
                updated = [...updated, joined];
              }
            }
            if (left) {
              updated = updated.filter((p) => p.instanceId !== left);
            }
            return { presence: updated };
          });
        });
        update._presenceUnsub = presenceUnsub;
      }

      if (newState === 'reconnecting') {
        update.reconnectAttempt = client.reconnectAttempts;
      }

      if (newState === 'disconnected') {
        update.serverInfo = null;
        update.snapshot = null;
        update.stateVersion = { presence: 0, health: 0 };
        update.auth = null;
        update.gatewayVersion = null;
        update.presence = [];
        const presenceUnsub = get()._presenceUnsub;
        if (presenceUnsub) presenceUnsub();
        update._presenceUnsub = null;
      }

      set(update);
    });

    set({ client });

    try {
      await client.connect();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown connection error',
        status: 'error',
      });
      throw err;
    }
  },

  disconnect: () => {
    const { client, _presenceUnsub } = get();
    if (client) {
      client.disconnect();
    }
    if (_presenceUnsub) _presenceUnsub();
    set({
      status: 'disconnected',
      serverInfo: null,
      snapshot: null,
      stateVersion: { presence: 0, health: 0 },
      auth: null,
      error: null,
      reconnectAttempt: 0,
      gatewayVersion: null,
      presence: [],
      _presenceUnsub: null,
    });
  },

  destroy: () => {
    const { client, _presenceUnsub } = get();
    if (client) {
      client.destroy();
    }
    if (_presenceUnsub) _presenceUnsub();
    set({
      client: null,
      status: 'disconnected',
      serverInfo: null,
      snapshot: null,
      stateVersion: { presence: 0, health: 0 },
      auth: null,
      error: null,
      reconnectAttempt: 0,
      gatewayVersion: null,
      presence: [],
      _presenceUnsub: null,
    });
  },

  request: async <T = unknown>(
    method: string,
    params?: unknown,
    options?: RequestOptions
  ): Promise<T> => {
    const { client } = get();
    if (!client) {
      throw new Error('Cannot send request: no gateway client');
    }
    return client.request<T>(method, params, options);
  },

  subscribe: <T = unknown>(event: string, handler: EventHandler<T>): Unsubscribe => {
    const { client } = get();
    if (!client) {
      console.warn(`[ConnectionStore] Cannot subscribe to "${event}": no gateway client`);
      return NOOP_UNSUBSCRIBE;
    }
    return client.on<T>(event, handler);
  },

  subscribeAll: (handler: EventHandler<EventFrame>): Unsubscribe => {
    const { client } = get();
    if (!client) {
      console.warn('[ConnectionStore] Cannot subscribe to all events: no gateway client');
      return NOOP_UNSUBSCRIBE;
    }
    return client.onAny(handler);
  },

  clearDeviceToken: async () => {
    const { gatewayUrl } = get();
    const deviceId = await getDeviceId();

    try {
      await deleteDeviceToken(deviceId, gatewayUrl);
      console.log('[ConnectionStore] Cleared device token from keychain');
    } catch (err) {
      console.warn('[ConnectionStore] Failed to clear device token from keychain:', err);
      throw err;
    }
  },
}));
