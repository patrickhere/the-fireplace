// ---------------------------------------------------------------------------
// Gateway Connection Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { GatewayClient } from '@/gateway/client';
import type {
  GatewayConnectionState,
  GatewayPolicy,
  StateVersion,
  EventHandler,
  EventFrame,
  Unsubscribe,
  RequestOptions,
} from '@/gateway/types';
import { buildClientInfo, buildDeviceIdentity } from '@/gateway/protocol';

// ---- Store Types ----------------------------------------------------------

interface ServerInfo {
  version: string | null;
  serverId: string | null;
  protocol: number;
  features: string[];
  policy: GatewayPolicy | null;
}

interface ConnectionState {
  // -- Reactive state (drives UI)
  status: GatewayConnectionState;
  serverInfo: ServerInfo | null;
  stateVersion: StateVersion;
  error: string | null;
  gatewayUrl: string;
  reconnectAttempt: number;

  // -- Client instance (not serializable, kept as a ref)
  client: GatewayClient | null;

  // -- Actions
  setGatewayUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  destroy: () => void;

  // -- Request forwarding
  request: <T = unknown>(method: string, params?: unknown, options?: RequestOptions) => Promise<T>;

  // -- Event forwarding
  subscribe: <T = unknown>(event: string, handler: EventHandler<T>) => Unsubscribe;
  subscribeAll: (handler: EventHandler<EventFrame>) => Unsubscribe;
}

// ---- Default Gateway URL --------------------------------------------------

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';

// ---- Noop unsubscribe (returned when client is not connected) -------------

const NOOP_UNSUBSCRIBE: Unsubscribe = () => {
  /* no-op */
};

// ---- Store ----------------------------------------------------------------

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'disconnected',
  serverInfo: null,
  stateVersion: { presence: 0, health: 0 },
  error: null,
  gatewayUrl: DEFAULT_GATEWAY_URL,
  reconnectAttempt: 0,
  client: null,

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
    // Device identity uses a placeholder nonce that will be replaced
    // when the server challenge arrives
    const device = buildDeviceIdentity('pending');

    const client = new GatewayClient({
      url: gatewayUrl,
      clientInfo,
      device,
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
        update.serverInfo = {
          version: client.serverVersion,
          serverId: client.serverId,
          protocol: client.serverProtocol ?? 3,
          features: client.serverFeatures,
          policy: client.serverPolicy,
        };
        update.stateVersion = client.stateVersion;
      }

      if (newState === 'reconnecting') {
        update.reconnectAttempt = client.reconnectAttempts;
      }

      if (newState === 'disconnected') {
        update.serverInfo = null;
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
    const { client } = get();
    if (client) {
      client.disconnect();
    }
    set({
      status: 'disconnected',
      serverInfo: null,
      error: null,
      reconnectAttempt: 0,
    });
  },

  destroy: () => {
    const { client } = get();
    if (client) {
      client.destroy();
    }
    set({
      client: null,
      status: 'disconnected',
      serverInfo: null,
      error: null,
      reconnectAttempt: 0,
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
}));
