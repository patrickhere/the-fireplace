// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Type Definitions
//
// These types are derived from the TypeBox schemas in
// docs/protocol/schema/*.d.ts and the protocol spec in
// docs/gateway/protocol.md. Run /protocol-check to verify alignment.
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

/**
 * Allowed client IDs per the GatewayClientIdSchema.
 * Only the IDs relevant to The Fireplace are typically used.
 */
export type GatewayClientId =
  | 'cli'
  | 'test'
  | 'webchat-ui'
  | 'openclaw-control-ui'
  | 'webchat'
  | 'gateway-client'
  | 'openclaw-macos'
  | 'openclaw-ios'
  | 'openclaw-android'
  | 'node-host'
  | 'fingerprint'
  | 'openclaw-probe';

/**
 * Allowed client modes per the GatewayClientModeSchema.
 */
export type GatewayClientMode = 'cli' | 'node' | 'test' | 'webchat' | 'ui' | 'backend' | 'probe';

export interface ConnectClientInfo {
  id: GatewayClientId;
  version: string;
  platform: string;
  mode: GatewayClientMode;
  displayName?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  instanceId?: string;
}

export interface ConnectAuth {
  token?: string;
  password?: string;
}

/**
 * Device identity for the connect handshake.
 * Field names match the ConnectParamsSchema.device shape exactly:
 *   id, publicKey, signature, signedAt, nonce
 */
export interface ConnectDevice {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce?: string;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: ConnectClientInfo;
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  auth?: ConnectAuth;
  locale?: string;
  userAgent?: string;
  device?: ConnectDevice;
}

// ---- Handshake: hello-ok response payload ---------------------------------

export interface HelloOkServer {
  version: string;
  commit?: string;
  host?: string;
  connId: string;
}

export interface HelloOkFeatures {
  methods: string[];
  events: string[];
}

/** Presence entry in the snapshot. */
export interface PresenceEntry {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  lastInputSeconds?: number;
  reason?: string;
  tags?: string[];
  text?: string;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
}

export interface SessionDefaults {
  defaultAgentId: string;
  mainKey: string;
  mainSessionKey: string;
  scope?: string;
}

export type AuthMode = 'none' | 'token' | 'password' | 'trusted-proxy';

/** Snapshot data returned in hello-ok. */
export interface Snapshot {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: StateVersion;
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: SessionDefaults;
  authMode?: AuthMode;
}

export interface GatewayPolicy {
  maxPayload: number;
  maxBufferedBytes: number;
  tickIntervalMs: number;
}

export interface HelloOkAuth {
  deviceToken: string;
  role: string;
  scopes: string[];
  issuedAtMs?: number;
}

export interface HelloOkPayload {
  type: 'hello-ok';
  protocol: number;
  server: HelloOkServer;
  features: HelloOkFeatures;
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: HelloOkAuth;
  policy: GatewayPolicy;
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
}

// ---- Reconnect State (internal) -------------------------------------------

export interface ReconnectState {
  attempts: number;
  nextDelayMs: number;
  timer: ReturnType<typeof setTimeout> | null;
}

// ---- Chat Event Payload ---------------------------------------------------
// The canonical ChatEventPayload type lives in src/stores/chat.ts.
// It uses { delta, done, error } fields matching our gateway fork's actual wire format.
// A conflicting type was previously defined here and has been removed.
// Import ChatEventPayload from '@/stores/chat' instead.

// ---- Tick / Shutdown Event Payloads ---------------------------------------

export interface TickEventPayload {
  ts: number;
}

export interface ShutdownEventPayload {
  reason: string;
  restartExpectedMs?: number;
}

// ---- Side-Effecting Methods -----------------------------------------------

/**
 * Methods that accept an idempotencyKey parameter.
 *
 * NOTE: OpenClaw only uses idempotencyKey for chat.send and node.invoke.
 * Other methods use different consistency mechanisms:
 * - Config operations use baseHash for optimistic concurrency control
 * - Pairing operations use requestId for identifying specific requests
 * - Most other operations don't need client-side idempotency keys
 *
 * The gateway enforces strict schema validation with additionalProperties: false,
 * so adding idempotencyKey to methods that don't accept it will cause errors.
 */
export const SIDE_EFFECTING_METHODS: ReadonlySet<string> = new Set(['chat.send', 'node.invoke']);
