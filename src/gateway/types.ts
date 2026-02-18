// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Type Definitions
//
// These types are derived from the TypeBox schemas in
// docs/protocol/schema/*.d.ts and the protocol spec in
// docs/gateway/protocol.md. Run /protocol-check to verify alignment.
//
// ---------------------------------------------------------------------------
// GATEWAY METHOD & EVENT CATALOG
// Source: backend/app/services/openclaw/gateway_rpc.py (GATEWAY_METHODS /
//         GATEWAY_EVENTS). Audited 2026-02-18 against our implementation.
//
// METHODS WE CALL (subset of full catalog):
//   Read:  sessions.list, sessions.preview, sessions.usage, models.list,
//          config.get, config.schema, agents.list, agents.files.list,
//          agents.files.get, skills.status, skills.bins, exec.approvals.get,
//          cron.list, cron.runs, logs.tail, channels.status, device.pair.list,
//          chat.history
//   Write: sessions.patch, sessions.reset, sessions.delete, sessions.compact,
//          config.patch, agents.create, agents.update, agents.delete,
//          agents.files.set, skills.install, skills.update, exec.approvals.set,
//          exec.approval.resolve, cron.add, cron.update, cron.remove, cron.run,
//          chat.send, chat.abort, chat.inject, channels.logout,
//          device.pair.approve, device.pair.reject, device.token.rotate,
//          device.token.revoke
//
// METHODS IN CATALOG WE DO NOT CALL (gateway extension/feature methods):
//   health, status, usage.status, usage.cost, tts.status, tts.providers,
//   tts.enable, tts.disable, tts.convert, tts.setProvider, config.set,
//   config.apply, exec.approvals.node.get, exec.approvals.node.set,
//   exec.approval.request, wizard.start, wizard.next, wizard.cancel,
//   wizard.status, talk.mode, update.run, voicewake.get, voicewake.set,
//   last-heartbeat, set-heartbeats, wake, node.pair.request, node.pair.list,
//   node.pair.approve, node.pair.reject, node.pair.verify, node.rename,
//   node.list, node.describe, node.invoke, node.invoke.result, node.event,
//   cron.status, system-presence, system-event, send, agent,
//   agent.identity.get, agent.wait, browser.request
//
// NOTE: chat.inject and sessions.usage are used by us but not in the base
//   catalog — they may be gateway-specific extensions on our server.
//
// EVENTS WE SUBSCRIBE TO:
//   agent, chat, session, channel, exec.approval.requested,
//   device.pair.requested, device.pair.resolved
//   (tick and shutdown are handled internally in client.ts)
//
// EVENTS IN CATALOG WE DO NOT SUBSCRIBE TO (potential future use):
//   presence        — could drive live presence display in UI
//   health          — server/agent health changes
//   heartbeat       — server heartbeats (monitoring)
//   cron            — real-time cron job status (currently we poll)
//   talk.mode       — voice/TTS mode changes
//   node.pair.requested / node.pair.resolved — node pairing approval flow
//   node.invoke.request — remote node invocation requests
//   voicewake.changed   — voice wake word setting changes
//   exec.approval.resolved — we subscribe to .requested but not .resolved
//
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

// ---- Gateway Method Catalog -----------------------------------------------
//
// Complete union of all known OpenClaw gateway RPC methods.
// Source: backend/app/services/openclaw/gateway_rpc.py::GATEWAY_METHODS
// Plus our extensions: chat.inject, sessions.usage
//
// Grouped by category for readability. Methods marked (*) are not currently
// called by The Fireplace but are known to exist on the gateway.

export type GatewayMethod =
  // -- System / Health
  | 'health' // (*) gateway health check
  | 'status' // (*) gateway status summary
  | 'last-heartbeat' // (*) get last client heartbeat time
  | 'set-heartbeats' // (*) configure heartbeat settings
  | 'wake' // (*) wake the gateway/agent

  // -- Logs
  | 'logs.tail' // stream recent log lines

  // -- Usage / Cost
  | 'usage.status' // (*) overall usage snapshot
  | 'usage.cost' // (*) cost breakdown
  | 'sessions.usage' // per-session usage data (extension)

  // -- TTS (Text-to-Speech)
  | 'tts.status' // (*) TTS enabled/disabled status
  | 'tts.providers' // (*) list TTS providers
  | 'tts.enable' // (*) enable TTS
  | 'tts.disable' // (*) disable TTS
  | 'tts.convert' // (*) convert text to speech
  | 'tts.setProvider' // (*) set active TTS provider

  // -- Config
  | 'config.get' // fetch current config
  | 'config.set' // (*) overwrite entire config
  | 'config.apply' // (*) apply config from file
  | 'config.patch' // patch config fields
  | 'config.schema' // fetch config JSON schema

  // -- Exec Approvals
  | 'exec.approvals.get' // fetch approval policy
  | 'exec.approvals.set' // update approval policy
  | 'exec.approvals.node.get' // (*) per-node approval policy
  | 'exec.approvals.node.set' // (*) update per-node approval policy
  | 'exec.approval.request' // (*) request approval from gateway
  | 'exec.approval.resolve' // resolve a pending approval

  // -- Setup Wizard
  | 'wizard.start' // (*) start onboarding wizard
  | 'wizard.next' // (*) next wizard step
  | 'wizard.cancel' // (*) cancel wizard
  | 'wizard.status' // (*) wizard current state

  // -- Talk / Voice
  | 'talk.mode' // (*) get/set voice mode

  // -- Models
  | 'models.list' // list available models

  // -- Agents
  | 'agents.list' // list agents
  | 'agents.create' // create an agent
  | 'agents.update' // update agent settings
  | 'agents.delete' // delete an agent
  | 'agents.files.list' // list agent soul files
  | 'agents.files.get' // get a specific soul file
  | 'agents.files.set' // write a soul file

  // -- Skills
  | 'skills.status' // list installed skills
  | 'skills.bins' // list available skill bins
  | 'skills.install' // install a skill
  | 'skills.update' // update an installed skill

  // -- Software Updates
  | 'update.run' // (*) trigger a gateway self-update

  // -- Voice Wake
  | 'voicewake.get' // (*) get voice wake word settings
  | 'voicewake.set' // (*) set voice wake word settings

  // -- Sessions
  | 'sessions.list' // list sessions
  | 'sessions.preview' // preview session messages (truncated)
  | 'sessions.patch' // update session settings (model, title, etc.)
  | 'sessions.reset' // reset/clear a session
  | 'sessions.delete' // delete a session
  | 'sessions.compact' // compact a session's history

  // -- Node Pairing
  | 'node.pair.request' // (*) request to pair a node
  | 'node.pair.list' // (*) list pending node pair requests
  | 'node.pair.approve' // (*) approve a node pair request
  | 'node.pair.reject' // (*) reject a node pair request
  | 'node.pair.verify' // (*) verify node pairing

  // -- Device Pairing
  | 'device.pair.list' // list pending device pair requests
  | 'device.pair.approve' // approve a device pair request
  | 'device.pair.reject' // reject a device pair request
  | 'device.token.rotate' // rotate a device auth token
  | 'device.token.revoke' // revoke a device auth token

  // -- Nodes (Remote Execution)
  | 'node.rename' // (*) rename a node
  | 'node.list' // (*) list registered nodes
  | 'node.describe' // (*) describe a node
  | 'node.invoke' // (*) invoke a command on a node
  | 'node.invoke.result' // (*) get result of a node invocation
  | 'node.event' // (*) emit an event on a node

  // -- Cron
  | 'cron.list' // list cron jobs
  | 'cron.status' // (*) cron scheduler status
  | 'cron.add' // create a cron job
  | 'cron.update' // update a cron job
  | 'cron.remove' // remove a cron job
  | 'cron.run' // manually trigger a cron job
  | 'cron.runs' // list cron run history

  // -- System (internal/special)
  | 'system-presence' // (*) update client presence info
  | 'system-event' // (*) emit a system-level event

  // -- Agent (legacy / low-level)
  | 'send' // (*) low-level agent message send
  | 'agent' // (*) agent control (start/stop/restart)
  | 'agent.identity.get' // (*) get agent identity info
  | 'agent.wait' // (*) wait for agent idle

  // -- Browser
  | 'browser.request' // (*) proxy a browser HTTP request

  // -- Channels
  | 'channels.status' // fetch channel connection status
  | 'channels.logout' // disconnect from a channel

  // -- Chat
  | 'chat.history' // fetch session message history
  | 'chat.abort' // abort a running generation
  | 'chat.send' // send a chat message
  | 'chat.inject'; // inject an operator message (extension)

// ---- Gateway Event Catalog ------------------------------------------------
//
// Complete union of all known OpenClaw gateway push events.
// Source: backend/app/services/openclaw/gateway_rpc.py::GATEWAY_EVENTS
//
// Events marked (*) are not currently subscribed to by The Fireplace.

export type GatewayEvent =
  // -- Handshake (handled internally by GatewayClient, not forwarded)
  | 'connect.challenge' // server challenge to initiate auth handshake

  // -- Agent Events
  | 'agent' // agent created/updated/deleted/file.changed

  // -- Chat Events
  | 'chat' // streaming chat response chunks

  // -- Presence
  | 'presence' // (*) client presence list changed

  // -- Keepalive / Lifecycle
  | 'tick' // server heartbeat tick (handled in client.ts)
  | 'shutdown' // server shutting down (handled in client.ts)
  | 'heartbeat' // (*) server heartbeat (distinct from tick)

  // -- Voice
  | 'talk.mode' // (*) voice/TTS mode changed
  | 'voicewake.changed' // (*) voice wake word settings changed

  // -- Health
  | 'health' // (*) gateway/agent health state changed

  // -- Cron
  | 'cron' // (*) cron job status update (real-time)

  // -- Node Pairing
  | 'node.pair.requested' // (*) node pair approval needed
  | 'node.pair.resolved' // (*) node pair request resolved
  | 'node.invoke.request' // (*) inbound node invocation request

  // -- Device Pairing
  | 'device.pair.requested' // device pair approval needed
  | 'device.pair.resolved' // device pair request resolved

  // -- Session Events
  | 'session' // session created/updated/deleted/reset

  // -- Channel Events
  | 'channel' // channel connected/disconnected/error/status

  // -- Exec Approvals
  | 'exec.approval.requested' // exec command needs approval
  | 'exec.approval.resolved'; // (*) exec approval was resolved

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
