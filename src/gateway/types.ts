// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 — Type Definitions
// ---------------------------------------------------------------------------

// ---- Wire Frame Types -----------------------------------------------------

/** Request frame sent from client to gateway. */
export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

/** Response frame received from gateway in reply to a request. */
export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayError;
}

/** Event frame pushed from gateway to client (unsolicited). */
export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
}

/** Union of all possible frames on the wire. */
export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

// ---- Error Shape ----------------------------------------------------------

export interface GatewayError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// ---- State Version Tracking -----------------------------------------------

export interface StateVersion {
  presence: number;
  health: number;
}

// ---- Handshake: connect.challenge -----------------------------------------

export interface ConnectChallengePayload {
  nonce: string;
  ts: number;
}

// ---- Handshake: connect request params ------------------------------------

export interface ConnectClientInfo {
  id: string;
  version: string;
  platform: string;
  mode: 'ui' | 'operator' | 'plugin';
}

export interface ConnectAuth {
  token?: string;
}

export interface ConnectDevice {
  fingerprint: string;
  publicKey: string;
  signedNonce: string;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: ConnectClientInfo;
  role: 'operator' | 'viewer';
  scopes: string[];
  auth: ConnectAuth;
  device: ConnectDevice;
}

// ---- Handshake: hello-ok response payload ---------------------------------

export interface GatewayPolicy {
  tickIntervalMs: number;
  maxIdleMs?: number;
  maxRequestsPerTick?: number;
}

export interface HelloOkPayload {
  type: 'hello-ok';
  protocol: number;
  serverId?: string;
  version?: string;
  features: string[];
  snapshot?: unknown;
  policy: GatewayPolicy;
  auth?: {
    token?: string;
    expiresAt?: number;
  };
}

// ---- Connection State -----------------------------------------------------

export type GatewayConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'challenged'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

// ---- Event Handler Signatures ---------------------------------------------

/** Handler for a specific named event. Receives only the payload. */
export type EventHandler<T = unknown> = (payload: T) => void;

/** Unsubscribe function returned by event subscriptions. */
export type Unsubscribe = () => void;

// ---- Request Options ------------------------------------------------------

export interface RequestOptions {
  /** Override the default request timeout (ms). */
  timeoutMs?: number;
  /** Idempotency key for side-effecting methods. */
  idempotencyKey?: string;
  /** AbortSignal to cancel the request from outside. */
  signal?: AbortSignal;
}

// ---- Pending Request Bookkeeping ------------------------------------------

export interface PendingRequest {
  method: string;
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---- Client Configuration -------------------------------------------------

export interface GatewayClientConfig {
  /** WebSocket URL to connect to. */
  url: string;
  /** Minimum backoff delay in ms for reconnect (default 1000). */
  reconnectMinMs?: number;
  /** Maximum backoff delay in ms for reconnect (default 30000). */
  reconnectMaxMs?: number;
  /** Default timeout for RPC requests in ms (default 30000). */
  defaultTimeoutMs?: number;
  /** Maximum number of automatic reconnect attempts (default Infinity). */
  maxReconnectAttempts?: number;
  /** Client identity info. */
  clientInfo: ConnectClientInfo;
  /** Device identity for the handshake. */
  device: ConnectDevice;
}

// ---- Reconnect State (internal) -------------------------------------------

export interface ReconnectState {
  attempts: number;
  nextDelayMs: number;
  timer: ReturnType<typeof setTimeout> | null;
}
