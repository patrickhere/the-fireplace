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
  generateRequestId,
  generateIdempotencyKey,
  getOrCreateDeviceFingerprint,
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
  GatewayPolicy,
  // Event system
  EventHandler,
  Unsubscribe,
  // Request helpers
  RequestOptions,
  PendingRequest,
  // Config
  GatewayClientConfig,
  ReconnectState,
} from './types';

export { SIDE_EFFECTING_METHODS } from './types';
