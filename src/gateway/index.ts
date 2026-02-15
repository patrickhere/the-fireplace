// ---------------------------------------------------------------------------
// Gateway module -- public API
// ---------------------------------------------------------------------------

export { GatewayClient, GatewayRequestError } from './client';
export type { StateChangeListener } from './client';

export {
  buildRequestFrame,
  buildConnectParams,
  buildClientInfo,
  buildDeviceIdentity,
  getDeviceId,
  generateRequestId,
  generateIdempotencyKey,
  detectPlatform,
  isValidFrame,
} from './protocol';

export type {
  // Wire frames
  RequestFrame,
  ResponseFrame,
  EventFrame,
  GatewayFrame,
  // Error
  GatewayError,
  // State
  StateVersion,
  GatewayConnectionState,
  // Handshake
  ConnectChallengePayload,
  ConnectParams,
  ConnectClientInfo,
  ConnectAuth,
  ConnectDevice,
  HelloOkPayload,
  HelloOkServer,
  HelloOkFeatures,
  HelloOkAuth,
  GatewayPolicy,
  // Snapshot
  Snapshot,
  PresenceEntry,
  SessionDefaults,
  AuthMode,
  // Chat events
  ChatEventPayload,
  // Tick / Shutdown events
  TickEventPayload,
  ShutdownEventPayload,
  // Event system
  EventHandler,
  Unsubscribe,
  // Request helpers
  RequestOptions,
  PendingRequest,
  // Config
  GatewayClientConfig,
  ReconnectState,
  // Client ID / mode literals
  GatewayClientId,
  GatewayClientMode,
} from './types';

export { SIDE_EFFECTING_METHODS } from './types';
