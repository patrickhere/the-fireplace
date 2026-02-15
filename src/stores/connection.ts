import { create } from 'zustand';
import { GatewayClient } from '@/gateway/client';
import type { GatewayConnectionState, GatewayPolicy, StateVersion } from '@/gateway/types';
import { buildClientInfo, buildDeviceIdentity } from '@/gateway/protocol';

// ---- Store Types ----------------------------------------------------------

interface ServerInfo {
  version: string | null;
  serverId: string | null;
  protocol: number;
  features: string[];
  policy: GatewayPolicy | null;
}

interface ConnectionStore {
  // State
  state: GatewayConnectionState;
  serverInfo: ServerInfo | null;
  stateVersion: StateVersion;
  error: string | null;
  gatewayUrl: string;
  reconnectAttempt: number;

  // The client instance (not serializable — kept as a ref)
  client: GatewayClient | null;

  // Actions
  setGatewayUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  destroy: () => void;
}

// ---- Default Gateway URL --------------------------------------------------

const DEFAULT_GATEWAY_URL = 'wss://patricks-macmini.pangolin-typhon.ts.net/';

// ---- Store ----------------------------------------------------------------

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  state: 'disconnected',
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

    set({ error: null, state: 'connecting' });

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
      const update: Partial<ConnectionStore> = { state: newState };

      if (newState === 'error') {
        update.error = 'Connection failed';
      }

      if (newState === 'connected') {
        update.error = null;
        update.reconnectAttempt = 0;
        update.serverInfo = {
          version: client.serverVersion,
          serverId: client.serverId,
          protocol: 3,
          features: client.serverFeatures,
          policy: client.serverPolicy,
        };
        update.stateVersion = client.stateVersion;
      }

      if (newState === 'reconnecting') {
        update.reconnectAttempt = (get().reconnectAttempt ?? 0) + 1;
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
        state: 'error',
      });
      throw err;
    }
  },

  disconnect: () => {
    const { client } = get();
    if (client) {
      client.disconnect();
    }
    set({ state: 'disconnected', serverInfo: null, error: null, reconnectAttempt: 0 });
  },

  destroy: () => {
    const { client } = get();
    if (client) {
      client.destroy();
    }
    set({
      client: null,
      state: 'disconnected',
      serverInfo: null,
      error: null,
      reconnectAttempt: 0,
    });
  },
}));
