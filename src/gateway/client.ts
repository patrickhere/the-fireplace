// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- GatewayClient
// ---------------------------------------------------------------------------

import type {
  ResponseFrame,
  EventFrame,
  ConnectChallengePayload,
  HelloOkPayload,
  GatewayConnectionState,
  GatewayPolicy,
  StateVersion,
  Snapshot,
  HelloOkServer,
  HelloOkFeatures,
  HelloOkAuth,
  EventHandler,
  Unsubscribe,
  RequestOptions,
  PendingRequest,
  GatewayClientConfig,
  ReconnectState,
  GatewayError,
  ShutdownEventPayload,
} from './types';
import { SIDE_EFFECTING_METHODS } from './types';
import {
  buildRequestFrame,
  buildConnectParams,
  buildDeviceIdentity,
  getDeviceId,
  generateIdempotencyKey,
  isValidFrame,
} from './protocol';
import { retrieveDeviceToken, storeDeviceToken } from '@/lib/keychain';

// ---- Constants ------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// Leader election via BroadcastChannel
const LEADER_CHANNEL_NAME = 'fireplace-gateway-leader';
const LEADER_HEARTBEAT_INTERVAL_MS = 2_000;
const LEADER_CLAIM_WINDOW_MS = 1_500;
const LEADER_MISSED_HEARTBEATS_THRESHOLD = 3; // promote after 3 missed heartbeats (~6s)
const DEFAULT_RECONNECT_MIN_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const IDEMPOTENCY_CACHE_MAX = 500;
const IDEMPOTENCY_CACHE_TTL_MS = 5 * 60_000;

// Tick watchdog: if no tick received within this multiplier × tickIntervalMs, reconnect
const TICK_WATCHDOG_MULTIPLIER = 2;
// Default tick interval to use when policy hasn't been received yet
const DEFAULT_TICK_INTERVAL_MS = 30_000;
// Watchdog poll period (how often we check for stale ticks)
const WATCHDOG_POLL_INTERVAL_MS = 5_000;

// Rate limiter: token bucket parameters
const RATE_LIMIT_CAPACITY = 20; // max burst
const RATE_LIMIT_REFILL_PER_SEC = 20; // sustained rate (tokens/second)

// Minimum gateway server version supported (semver prefix check)
const MIN_GATEWAY_VERSION = '2026.1.0';

// ---- Custom Error ---------------------------------------------------------

export class GatewayRequestError extends Error {
  public readonly code: string;
  public readonly details: unknown;
  public readonly retryable: boolean;
  public readonly retryAfterMs: number | undefined;

  constructor(err: GatewayError) {
    super(err.message);
    this.name = 'GatewayRequestError';
    this.code = err.code;
    this.details = err.details;
    this.retryable = err.retryable ?? false;
    this.retryAfterMs = err.retryAfterMs;
  }
}

// ---- State Change Listener ------------------------------------------------

export type StateChangeListener = (
  newState: GatewayConnectionState,
  oldState: GatewayConnectionState
) => void;

// ---- GatewayClient --------------------------------------------------------

export class GatewayClient {
  // -- Configuration
  private readonly config: Required<
    Pick<
      GatewayClientConfig,
      'reconnectMinMs' | 'reconnectMaxMs' | 'defaultTimeoutMs' | 'maxReconnectAttempts'
    >
  > &
    GatewayClientConfig;

  // -- WebSocket
  private ws: WebSocket | null = null;

  // -- Connection state
  private _state: GatewayConnectionState = 'disconnected';
  private stateListeners = new Set<StateChangeListener>();
  private _lastError: GatewayError | null = null;

  // -- Handshake
  private handshakeResolve: (() => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Server info (populated after hello-ok)
  private _serverInfo: HelloOkServer | null = null;
  private _serverPolicy: GatewayPolicy | null = null;
  private _serverFeatures: HelloOkFeatures | null = null;
  private _serverProtocol: number | null = null;
  private _snapshot: Snapshot | null = null;
  private _canvasHostUrl: string | null = null;
  private _auth: HelloOkAuth | null = null;

  // -- State version tracking
  private _stateVersion: StateVersion = { presence: 0, health: 0 };

  // -- Request/response matching
  private pendingRequests = new Map<string, PendingRequest>();

  // -- Event subscriptions
  private eventHandlers = new Map<string, Set<EventHandler>>();
  // Wildcard listeners that receive every event
  private wildcardHandlers = new Set<EventHandler<EventFrame>>();

  // -- Event sequence tracking
  private _lastSeq = 0;

  // -- Reconnect
  private reconnect: ReconnectState = {
    attempts: 0,
    nextDelayMs: DEFAULT_RECONNECT_MIN_MS,
    timer: null,
  };
  private intentionalClose = false;

  // -- Tick / watchdog
  private _lastTickReceivedAt = 0;
  private _watchdogTimer: ReturnType<typeof setInterval> | null = null;

  // -- Visibility change listener (iOS foreground/background)
  private _visibilityHandler: (() => void) | null = null;

  // -- Leader election (BroadcastChannel)
  private _leaderChannel: BroadcastChannel | null = null;
  private _isLeader = false;
  private _contenderId: string = crypto.randomUUID();
  private _leaderHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _followerWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private _missedHeartbeats = 0;
  private _beforeUnloadHandler: (() => void) | null = null;

  // -- Rate limiter (token bucket)
  private _rlTokens = RATE_LIMIT_CAPACITY;
  private _rlLastRefillAt = Date.now();
  private _rlQueue: Array<() => void> = [];
  private _rlDrainTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Idempotency key tracking (Map<key, timestamp> for O(1) lookups)
  private idempotencyCache = new Map<string, number>();

  // ---- Constructor --------------------------------------------------------

  constructor(config: GatewayClientConfig) {
    this.config = {
      ...config,
      reconnectMinMs: config.reconnectMinMs ?? DEFAULT_RECONNECT_MIN_MS,
      reconnectMaxMs: config.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS,
      defaultTimeoutMs: config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxReconnectAttempts: config.maxReconnectAttempts ?? Infinity,
    };
  }

  // ---- Public Accessors ---------------------------------------------------

  get state(): GatewayConnectionState {
    return this._state;
  }

  get lastError(): GatewayError | null {
    return this._lastError;
  }

  get serverPolicy(): GatewayPolicy | null {
    return this._serverPolicy;
  }

  get serverFeatures(): HelloOkFeatures | null {
    return this._serverFeatures;
  }

  /** Server identity from hello-ok: { version, commit, host, connId }. */
  get serverInfo(): HelloOkServer | null {
    return this._serverInfo;
  }

  get serverVersion(): string | null {
    return this._serverInfo?.version ?? null;
  }

  get serverId(): string | null {
    return this._serverInfo?.connId ?? null;
  }

  get serverProtocol(): number | null {
    return this._serverProtocol;
  }

  /** Device auth token returned by the server during handshake, if any. */
  get authToken(): string | null {
    return this._auth?.deviceToken ?? null;
  }

  /** Full auth object from hello-ok: { deviceToken, role, scopes, issuedAtMs }. */
  get auth(): HelloOkAuth | null {
    return this._auth;
  }

  /** Snapshot data received during the handshake. */
  get snapshot(): Snapshot | null {
    return this._snapshot;
  }

  /** Canvas host URL from hello-ok, if provided. */
  get canvasHostUrl(): string | null {
    return this._canvasHostUrl;
  }

  get stateVersion(): StateVersion {
    return { ...this._stateVersion };
  }

  get lastSeq(): number {
    return this._lastSeq;
  }

  get url(): string {
    return this.config.url;
  }

  get reconnectAttempts(): number {
    return this.reconnect.attempts;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  // ---- State Management ---------------------------------------------------

  private setState(next: GatewayConnectionState): void {
    const prev = this._state;
    if (prev === next) return;
    this._state = next;
    for (const listener of this.stateListeners) {
      try {
        listener(next, prev);
      } catch (err) {
        console.error('[Gateway] State listener error:', err);
      }
    }
  }

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onStateChange(listener: StateChangeListener): Unsubscribe {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  // ---- Connect / Disconnect -----------------------------------------------

  /**
   * Open a WebSocket connection and perform the full v3 handshake.
   *
   * Flow:
   *   1. Client opens WebSocket to gateway URL
   *   2. Server sends `connect.challenge` event with { nonce, ts }
   *   3. Client sends `connect` request with client info, role, scopes, auth, device
   *   4. Server responds with `hello-ok` containing features, snapshot, policy, auth
   *
   * Resolves when the handshake completes (hello-ok received).
   * Rejects if the WebSocket fails to open or the handshake times out.
   */
  async connect(urlOverride?: string): Promise<void> {
    if (this._state === 'connected') {
      console.warn('[Gateway] Already connected -- ignoring connect()');
      return;
    }
    if (this._state === 'connecting' || this._state === 'authenticating') {
      throw new Error(
        `Connection already in progress (state="${this._state}"). ` +
          'Wait for the current connect() to resolve or call disconnect() first.'
      );
    }

    this.intentionalClose = false;
    this.cancelReconnectTimer();
    this._lastError = null;

    // Leader election: ensure only one tab maintains a WebSocket connection
    const isLeader = await this.tryClaimLeadership();
    if (!isLeader) {
      // Another tab is already connected — do not open a duplicate socket
      if (this._state === 'reconnecting') {
        this.setState('disconnected');
      }
      return;
    }

    const url = urlOverride ?? this.config.url;

    this.setState('connecting');
    console.log(`[Gateway] Connecting to ${url}`);

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        this.setState('error');
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      // Store handshake promise controls so handleMessage can resolve them
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;

      // Handshake timeout -- if server never sends challenge or hello-ok
      this.handshakeTimer = setTimeout(() => {
        this.handshakeTimer = null;
        const err = new Error('Handshake timeout: server did not complete v3 handshake');
        this.abortConnection(err);
      }, HANDSHAKE_TIMEOUT_MS);

      this.ws.onopen = () => {
        console.log('[Gateway] WebSocket transport open, awaiting connect.challenge...');
        // Do NOT resolve here -- we wait for the full handshake
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          console.warn('[Gateway] Ignoring non-string WebSocket message:', typeof event.data);
          return;
        }
        this.handleMessage(event.data);
      };

      this.ws.onerror = (_event: Event) => {
        console.error('[Gateway] WebSocket error');
        // onerror is always followed by onclose, so we let onclose handle state
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log(`[Gateway] WebSocket closed: code=${event.code} reason=${event.reason}`);
        this.handleClose(event);
      };
    });
  }

  /**
   * Gracefully close the connection. No automatic reconnect will occur.
   */
  disconnect(): void {
    console.log('[Gateway] Disconnecting (intentional)');
    this.intentionalClose = true;
    this.cancelReconnectTimer();
    this.stopWatchdog();
    this.removeVisibilityListener();
    this.releaseLeadership();
    if (this.ws) {
      // Close with normal closure code
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.rejectAllPending(new Error('Client disconnected'));
    this.clearHandshake(new Error('Client disconnected'));
    this.setState('disconnected');
  }

  /**
   * Update the URL and reconnect. Useful when the user changes the gateway URL.
   */
  async reconnectTo(url: string): Promise<void> {
    this.config.url = url;
    this.disconnect();
    // Brief delay to let the old socket fully tear down
    await new Promise<void>((r) => setTimeout(r, 100));
    return this.connect(url);
  }

  // ---- RPC Requests -------------------------------------------------------

  /**
   * Send an RPC request and wait for the matching response.
   *
   * For methods in SIDE_EFFECTING_METHODS (chat.send, node.invoke), an
   * idempotency key is automatically generated if one is not provided.
   * The key is injected as `idempotencyKey` on the params object (matching
   * the server schema where it is a top-level required field on the params).
   * Other methods use different consistency mechanisms (baseHash, requestId).
   *
   * @param method - The RPC method name (e.g. "sessions.list")
   * @param params - Optional parameters for the method
   * @param options - Timeout, idempotency key, abort signal
   * @returns The response payload (the `payload` field from the ResponseFrame)
   */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    if (this._state !== 'connected') {
      throw new Error(`Cannot send request: state is "${this._state}", expected "connected"`);
    }

    // Rate limiting: wait for a token before proceeding
    await this.acquireRateLimitToken(method);

    // Determine idempotency key
    let idempotencyKey = options?.idempotencyKey;
    if (!idempotencyKey && SIDE_EFFECTING_METHODS.has(method)) {
      idempotencyKey = generateIdempotencyKey();
    }

    // Check idempotency cache for duplicate submissions
    if (idempotencyKey && this.hasIdempotencyKey(idempotencyKey)) {
      throw new Error(`Duplicate request: idempotency key "${idempotencyKey}" was already used`);
    }

    // Inject idempotency key into params (server schemas expect it as
    // a top-level field named `idempotencyKey` on the params object)
    let finalParams = params;
    if (idempotencyKey) {
      if (typeof finalParams === 'object' && finalParams !== null) {
        finalParams = { ...finalParams, idempotencyKey };
      } else if (finalParams === undefined || finalParams === null) {
        finalParams = { idempotencyKey };
      }
    }

    const frame = buildRequestFrame(method, finalParams);
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;

    // Track the idempotency key
    if (idempotencyKey) {
      this.trackIdempotencyKey(idempotencyKey);
    }

    return new Promise<T>((resolve, reject) => {
      const signal = options?.signal;

      // Handle external abort
      let onAbort: (() => void) | null = null;
      if (signal) {
        if (signal.aborted) {
          reject(new Error(`Request aborted: ${method}`));
          return;
        }
        onAbort = () => {
          const pending = this.pendingRequests.get(frame.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(frame.id);
            reject(new Error(`Request aborted: ${method}`));
          }
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      // Helper to clean up the abort listener when the request settles normally
      const cleanupAbortListener = () => {
        if (signal && onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const timer = setTimeout(() => {
        cleanupAbortListener();
        this.pendingRequests.delete(frame.id);
        reject(new Error(`Request timeout after ${timeoutMs}ms: ${method} (id=${frame.id})`));
      }, timeoutMs);

      this.pendingRequests.set(frame.id, {
        method,
        resolve: (payload: unknown) => {
          cleanupAbortListener();
          (resolve as (value: unknown) => void)(payload);
        },
        reject: (err: Error) => {
          cleanupAbortListener();
          reject(err);
        },
        timer,
      });

      this.send(frame);
    });
  }

  /**
   * Convenience: send a side-effecting request with an explicit
   * auto-generated idempotency key.
   */
  async requestWithIdempotency<T = unknown>(
    method: string,
    params?: unknown,
    options?: Omit<RequestOptions, 'idempotencyKey'>
  ): Promise<T> {
    return this.request<T>(method, params, {
      ...options,
      idempotencyKey: generateIdempotencyKey(),
    });
  }

  // ---- Event Subscriptions ------------------------------------------------

  /**
   * Subscribe to a named gateway event.
   *
   * @param event - Event name (e.g. "chat", "exec.approval.requested")
   * @param handler - Callback receiving the event payload
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): Unsubscribe {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler as EventHandler);
    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    };
  }

  /**
   * Remove a specific handler from a named event.
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Subscribe to ALL events (wildcard). Handler receives the full EventFrame.
   */
  onAny(handler: EventHandler<EventFrame>): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to an event, automatically unsubscribe after the first delivery.
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): Unsubscribe {
    const unsub = this.on<T>(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  // ---- Internals: Message Handling ----------------------------------------

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('[Gateway] Failed to parse incoming frame:', err);
      return;
    }

    if (!isValidFrame(parsed)) {
      console.warn('[Gateway] Received invalid frame (no type field):', parsed);
      return;
    }

    switch (parsed.type) {
      case 'res':
        this.handleResponse(parsed);
        break;
      case 'event':
        this.handleEvent(parsed);
        break;
      case 'req':
        // Server-initiated requests are not expected in v3 from the client side.
        console.warn('[Gateway] Received unexpected server-initiated request:', parsed);
        break;
    }
  }

  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) {
      console.warn(`[Gateway] Received response for unknown request id=${frame.id}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else if (frame.error) {
      this._lastError = frame.error;
      pending.reject(new GatewayRequestError(frame.error));
    } else {
      pending.reject(new Error(`Request failed without error details: ${pending.method}`));
    }
  }

  private handleEvent(frame: EventFrame): void {
    // Track sequence numbers
    if (frame.seq !== undefined) {
      if (frame.seq > this._lastSeq + 1 && this._lastSeq > 0) {
        console.warn(
          `[Gateway] Event sequence gap: expected ${this._lastSeq + 1}, got ${frame.seq} — requesting state refresh`
        );
        this.requestStateRefresh();
      }
      this._lastSeq = frame.seq;
    }

    // Track state versions
    if (frame.stateVersion) {
      this._stateVersion = { ...frame.stateVersion };
    }

    // Handle handshake events specially
    if (frame.event === 'connect.challenge') {
      this.handleChallenge(frame.payload as ConnectChallengePayload);
      return;
    }

    // Handle tick events for watchdog tracking
    if (frame.event === 'tick') {
      this._lastTickReceivedAt = Date.now();
    }

    // Handle shutdown events
    if (frame.event === 'shutdown') {
      this.handleShutdown(frame.payload as ShutdownEventPayload);
      // Still emit to handlers below
    }

    // Emit to specific handlers
    const handlers = this.eventHandlers.get(frame.event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(frame.payload);
        } catch (err) {
          console.error(`[Gateway] Event handler error for "${frame.event}":`, err);
        }
      }
    }

    // Emit to wildcard handlers
    for (const handler of this.wildcardHandlers) {
      try {
        handler(frame);
      } catch (err) {
        console.error('[Gateway] Wildcard event handler error:', err);
      }
    }
  }

  // ---- Internals: Handshake -----------------------------------------------

  /**
   * Handle the connect.challenge event from the server.
   *
   * Step 2 of the v3 handshake: build and send the `connect` request
   * with client identity, role, scopes, auth, and device info.
   *
   * Before sending the connect request, attempts to load a stored device
   * token from the keychain. If found, includes it in the auth field for
   * automatic re-authentication without needing device pairing approval.
   */
  private async handleChallengeAsync(challenge: ConnectChallengePayload): Promise<void> {
    console.log(
      `[Gateway] Received connect.challenge: nonce=${challenge.nonce} ts=${challenge.ts}`
    );
    this.setState('challenged');

    // Get device ID first (needed to look up stored token)
    const deviceId = await getDeviceId();

    // Check connection is still alive after async invoke
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection closed during authentication (after getDeviceId)');
    }

    // Try to retrieve stored device token from keychain
    let authToken: string | undefined;
    try {
      const storedToken = await retrieveDeviceToken(deviceId, this.config.url);
      authToken = storedToken.token;
      console.log('[Gateway] Using stored device token from keychain');
    } catch {
      // Token not found or keychain access failed -- proceed without token
      console.log('[Gateway] No stored device token found, proceeding with device pairing');
    }

    // Check connection is still alive after async keychain access
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection closed during authentication (after retrieveDeviceToken)');
    }

    // Build device identity with all parameters (including token for signature)
    const scopes = ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals'];
    const device = await buildDeviceIdentity(
      challenge.nonce,
      this.config.clientInfo,
      'operator',
      scopes,
      authToken,
      deviceId
    );

    // Check connection is still alive after async signing
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection closed during authentication (after buildDeviceIdentity)');
    }

    const connectParams = buildConnectParams(this.config.clientInfo, device, scopes, authToken);

    const connectFrame = buildRequestFrame('connect', connectParams);

    this.setState('authenticating');
    console.log('[Gateway] Sending connect request...');

    // Register a pending request for the connect response
    const timer = setTimeout(() => {
      this.pendingRequests.delete(connectFrame.id);
      const err = new Error('Connect request timed out waiting for hello-ok');
      this.abortConnection(err);
    }, HANDSHAKE_TIMEOUT_MS);

    this.pendingRequests.set(connectFrame.id, {
      method: 'connect',
      resolve: (payload: unknown) => {
        this.handleHelloOk(payload as HelloOkPayload);
      },
      reject: (err: Error) => {
        console.error('[Gateway] Connect request rejected:', err);
        this.abortConnection(err);
      },
      timer,
    });

    this.send(connectFrame);
  }

  /**
   * Synchronous wrapper for handleChallengeAsync to maintain compatibility
   * with existing event handling code. Catches and logs errors from the
   * async flow but does not propagate them (they'll be caught by the
   * handshake timeout or connection error handling).
   */
  private handleChallenge(challenge: ConnectChallengePayload): void {
    this.handleChallengeAsync(challenge).catch((err) => {
      console.error('[Gateway] Error in challenge handling:', err);
      this.abortConnection(err instanceof Error ? err : new Error(String(err)));
    });
  }

  /**
   * Handle the hello-ok response from the server.
   *
   * Step 4 of the v3 handshake: store server info, persist device token
   * to keychain, start tick watchdog, and mark the connection as established.
   */
  private handleHelloOk(payload: HelloOkPayload): void {
    if (payload.type !== 'hello-ok') {
      const err = new Error(`Expected hello-ok, got: ${payload.type}`);
      this.abortConnection(err);
      return;
    }

    console.log(
      `[Gateway] Handshake complete: protocol=${payload.protocol} ` +
        `server=${payload.server.version} connId=${payload.server.connId} ` +
        `methods=[${payload.features.methods.length}] events=[${payload.features.events.length}]`
    );

    // Store server info
    this._serverInfo = payload.server;
    this._serverPolicy = payload.policy;
    this._serverFeatures = payload.features;
    this._serverProtocol = payload.protocol;
    this._snapshot = payload.snapshot;
    this._canvasHostUrl = payload.canvasHostUrl ?? null;
    if (payload.auth) {
      this._auth = payload.auth;
    }

    // Initialize state version from snapshot
    if (payload.snapshot?.stateVersion) {
      this._stateVersion = { ...payload.snapshot.stateVersion };
    }

    // Persist device token to keychain if provided
    if (payload.auth?.deviceToken) {
      getDeviceId()
        .then((deviceId) =>
          storeDeviceToken(
            deviceId,
            this.config.url,
            payload.auth!.deviceToken!,
            payload.auth!.role,
            payload.auth!.scopes,
            payload.auth!.issuedAtMs ?? Date.now()
          )
        )
        .catch((err) => {
          // Log keychain storage errors but do not fail the connection
          console.warn('[Gateway] Failed to store device token in keychain:', err);
        });
    }

    // Check gateway version compatibility
    this.checkGatewayVersion(payload.server.version);

    // Reset reconnect state on successful connection
    this.reconnect.attempts = 0;
    this.reconnect.nextDelayMs = this.config.reconnectMinMs;

    // Mark connected
    this.setState('connected');

    // Start tick watchdog
    this.startWatchdog();

    // Register visibility listener for iOS background/foreground
    this.registerVisibilityListener();

    // Resolve the connect() promise
    this.clearHandshake();
  }

  // ---- Internals: Shutdown ------------------------------------------------

  /**
   * Handle a shutdown event from the server. Logs the reason and prepares
   * for a potential restart. If restartExpectedMs is provided, the
   * reconnect delay is adjusted accordingly.
   */
  private handleShutdown(payload: ShutdownEventPayload): void {
    console.log(
      `[Gateway] Server shutting down: reason="${payload.reason}"` +
        (payload.restartExpectedMs ? ` restartIn=${payload.restartExpectedMs}ms` : '')
    );

    // If the server tells us when it will restart, adjust the reconnect
    // delay so we do not reconnect too early.
    if (payload.restartExpectedMs && payload.restartExpectedMs > 0) {
      this.reconnect.nextDelayMs = Math.max(this.reconnect.nextDelayMs, payload.restartExpectedMs);
    }
  }

  // ---- Internals: Tick / Watchdog -----------------------------------------

  /** Timestamp (ms since epoch) of the last tick event received from server. */
  get lastTickReceivedAt(): number {
    return this._lastTickReceivedAt;
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this._lastTickReceivedAt = Date.now(); // treat connection as a fresh tick

    this._watchdogTimer = setInterval(() => {
      if (this._state !== 'connected') return;

      const tickInterval = this._serverPolicy?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
      const threshold = TICK_WATCHDOG_MULTIPLIER * tickInterval;
      const elapsed = Date.now() - this._lastTickReceivedAt;

      if (elapsed > threshold) {
        console.warn(
          `[Gateway] Tick watchdog: no tick received for ${elapsed}ms (threshold ${threshold}ms) — triggering reconnect`
        );
        this.stopWatchdog();
        this.removeVisibilityListener();
        // Mark intentional so handleClose skips redundant cleanup
        this.intentionalClose = true;
        // Proactively clean up before closing the socket
        this.releaseLeadership();
        this.rejectAllPending(new Error('Tick watchdog timeout'));
        if (this.ws) {
          const sock = this.ws;
          this.ws = null;
          sock.close(4001, 'Tick watchdog timeout');
        }
        this.setState('reconnecting');
        this.intentionalClose = false;
        this.scheduleReconnect();
      }
    }, WATCHDOG_POLL_INTERVAL_MS);
  }

  private stopWatchdog(): void {
    if (this._watchdogTimer !== null) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
  }

  // ---- Internals: Visibility / iOS Lifecycle ------------------------------

  private registerVisibilityListener(): void {
    this.removeVisibilityListener();

    const handler = () => {
      if (document.visibilityState !== 'visible') return;

      const tickInterval = this._serverPolicy?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
      const threshold = TICK_WATCHDOG_MULTIPLIER * tickInterval;
      const elapsed = Date.now() - this._lastTickReceivedAt;

      if (this._state !== 'connected' || elapsed > threshold) {
        console.warn(
          `[Gateway] Visibility resumed — connection stale (${elapsed}ms since last tick, state=${this._state}) — reconnecting`
        );
        this.stopWatchdog();
        this.removeVisibilityListener();
        this.releaseLeadership();
        this.rejectAllPending(new Error('Connection stale after visibility resume'));
        if (this.ws) {
          this.intentionalClose = true;
          const sock = this.ws;
          this.ws = null;
          sock.close(4002, 'Visibility resume reconnect');
          this.intentionalClose = false;
        }
        this.scheduleReconnect();
      } else {
        console.log('[Gateway] Visibility resumed — connection still healthy');
      }
    };

    document.addEventListener('visibilitychange', handler);
    this._visibilityHandler = handler;
  }

  private removeVisibilityListener(): void {
    if (this._visibilityHandler !== null) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  // ---- Internals: Rate Limiter (Token Bucket) -----------------------------

  private refillRateLimitTokens(): void {
    const now = Date.now();
    const elapsed = (now - this._rlLastRefillAt) / 1000; // seconds
    const refill = elapsed * RATE_LIMIT_REFILL_PER_SEC;
    this._rlTokens = Math.min(RATE_LIMIT_CAPACITY, this._rlTokens + refill);
    this._rlLastRefillAt = now;
  }

  private acquireRateLimitToken(method: string): Promise<void> {
    this.refillRateLimitTokens();

    if (this._rlTokens >= 1) {
      this._rlTokens -= 1;
      return Promise.resolve();
    }

    // Queue the request — it will be released when tokens refill
    console.warn(
      `[Gateway] Rate limit reached — queuing "${method}" (queue depth: ${this._rlQueue.length + 1})`
    );
    return new Promise<void>((resolve) => {
      this._rlQueue.push(resolve);
      this.scheduleDrainRateLimitQueue();
    });
  }

  private scheduleDrainRateLimitQueue(): void {
    if (this._rlDrainTimer !== null) return;

    const msPerToken = 1000 / RATE_LIMIT_REFILL_PER_SEC;
    this._rlDrainTimer = setTimeout(() => {
      this._rlDrainTimer = null;
      this.refillRateLimitTokens();

      while (this._rlQueue.length > 0 && this._rlTokens >= 1) {
        this._rlTokens -= 1;
        const next = this._rlQueue.shift();
        if (next) next();
      }

      if (this._rlQueue.length > 0) {
        this.scheduleDrainRateLimitQueue();
      }
    }, msPerToken);
  }

  // ---- Internals: State Refresh -------------------------------------------

  /**
   * Re-fetch critical gateway state after an event sequence gap.
   * Emits a synthetic "state.refresh" event so stores can react.
   */
  private requestStateRefresh(): void {
    if (this._state !== 'connected') return;

    // Fire and forget — stores listen to the emitted events
    void (async () => {
      try {
        console.log('[Gateway] Requesting state refresh after sequence gap...');
        const [sessions, agents] = await Promise.all([
          this.request('sessions.list').catch(() => null),
          this.request('agents.list').catch(() => null),
        ]);

        // If both requests failed, log a warning and skip the synthetic event
        if (sessions === null && agents === null) {
          console.warn(
            '[Gateway] State refresh failed: both sessions.list and agents.list returned errors'
          );
          return;
        }

        // Emit a synthetic event so stores can pick up refreshed data
        const synthFrame: EventFrame = {
          type: 'event' as const,
          event: 'state.refresh',
          payload: { sessions, agents },
        };
        const handlers = this.eventHandlers.get('state.refresh');
        if (handlers) {
          for (const h of handlers) {
            try {
              h(synthFrame.payload);
            } catch {
              /* ignore */
            }
          }
        }
        for (const h of this.wildcardHandlers) {
          try {
            h(synthFrame);
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.warn('[Gateway] State refresh failed:', err);
      }
    })();
  }

  // ---- Internals: Version Compatibility -----------------------------------

  /**
   * Compare server version against the minimum required version.
   * Logs a warning if the server version is below the minimum.
   * Version format expected: YYYY.M.patch (e.g. "2026.1.29")
   */
  private checkGatewayVersion(version: string): void {
    try {
      const parse = (v: string): [number, number, number] => {
        const parts = v.split('.').map((p) => parseInt(p, 10));
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
      };

      const [minYear, minMonth, minPatch] = parse(MIN_GATEWAY_VERSION);
      const [srvYear, srvMonth, srvPatch] = parse(version);

      const isOk =
        srvYear > minYear ||
        (srvYear === minYear && srvMonth > minMonth) ||
        (srvYear === minYear && srvMonth === minMonth && srvPatch >= minPatch);

      if (!isOk) {
        console.warn(
          `[Gateway] Server version "${version}" is below the minimum supported ` +
            `version "${MIN_GATEWAY_VERSION}". Some features may not work correctly. ` +
            `Please update the OpenClaw gateway.`
        );
      } else {
        console.log(`[Gateway] Server version "${version}" meets minimum requirement.`);
      }
    } catch {
      console.warn(`[Gateway] Could not parse server version "${version}" for compatibility check`);
    }
  }

  // ---- Internals: Send ----------------------------------------------------

  private send(frame: { type: string; id: string; method?: string; params?: unknown }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot send: WebSocket is not open');
    }
    const raw = JSON.stringify(frame);
    this.ws.send(raw);
  }

  // ---- Internals: Close & Reconnect --------------------------------------

  private handleClose(_event: CloseEvent): void {
    // Guard: if ws is already null, cleanup was handled elsewhere (e.g. watchdog)
    if (!this.ws) {
      // Still transition to disconnected if this was an intentional close
      // that hasn't been handled yet
      if (
        this.intentionalClose &&
        this._state !== 'disconnected' &&
        this._state !== 'reconnecting'
      ) {
        this.setState('disconnected');
      }
      return;
    }
    this.ws = null;
    this.releaseLeadership();

    // If we were still in the handshake phase, reject the connect() promise
    if (this.handshakeReject) {
      this.clearHandshake(new Error('WebSocket closed during handshake'));
    }

    // Reject all pending requests
    this.rejectAllPending(new Error('WebSocket connection closed'));

    if (this.intentionalClose) {
      this.setState('disconnected');
      return;
    }

    // Automatic reconnect
    if (this.reconnect.attempts >= this.config.maxReconnectAttempts) {
      console.error(
        `[Gateway] Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`
      );
      this.setState('error');
      return;
    }

    this.scheduleReconnect();
  }

  /**
   * Schedule an automatic reconnection attempt with exponential backoff
   * and jitter. Starts at reconnectMinMs (default 1s), doubling each
   * attempt up to reconnectMaxMs (default 30s).
   */
  private scheduleReconnect(): void {
    this.setState('reconnecting');

    const delay = this.reconnect.nextDelayMs;
    this.reconnect.attempts += 1;

    // Exponential backoff with jitter (up to 30% of the delay)
    const jitter = Math.random() * 0.3 * delay;
    const nextDelay = Math.min(delay * 2, this.config.reconnectMaxMs);
    this.reconnect.nextDelayMs = nextDelay;

    const actualDelay = Math.round(delay + jitter);
    console.log(`[Gateway] Scheduling reconnect #${this.reconnect.attempts} in ${actualDelay}ms`);

    this.reconnect.timer = setTimeout(() => {
      this.reconnect.timer = null;
      console.log(`[Gateway] Reconnect attempt #${this.reconnect.attempts}`);
      this.connect().catch((err) => {
        console.error('[Gateway] Reconnect failed:', err);
        // handleClose will be called by WebSocket close, which schedules next retry
      });
    }, actualDelay);
  }

  private cancelReconnectTimer(): void {
    if (this.reconnect.timer !== null) {
      clearTimeout(this.reconnect.timer);
      this.reconnect.timer = null;
    }
  }

  /** Reset reconnect counters (e.g. after a successful manual connect). */
  resetReconnect(): void {
    this.cancelReconnectTimer();
    this.reconnect.attempts = 0;
    this.reconnect.nextDelayMs = this.config.reconnectMinMs;
  }

  // ---- Internals: Idempotency Key Tracking --------------------------------

  /**
   * Track a used idempotency key. Evicts stale entries beyond the cache
   * size limit and TTL.
   */
  private trackIdempotencyKey(key: string): void {
    const now = Date.now();

    // Evict expired entries
    if (this.idempotencyCache.size >= IDEMPOTENCY_CACHE_MAX) {
      for (const [k, ts] of this.idempotencyCache) {
        if (now - ts >= IDEMPOTENCY_CACHE_TTL_MS) {
          this.idempotencyCache.delete(k);
        }
      }
    }

    // If still at capacity after TTL eviction, remove oldest entries
    if (this.idempotencyCache.size >= IDEMPOTENCY_CACHE_MAX) {
      const excess = this.idempotencyCache.size - IDEMPOTENCY_CACHE_MAX + 1;
      let removed = 0;
      for (const k of this.idempotencyCache.keys()) {
        if (removed >= excess) break;
        this.idempotencyCache.delete(k);
        removed++;
      }
    }

    this.idempotencyCache.set(key, now);
  }

  /**
   * Check if an idempotency key has been used recently.
   */
  private hasIdempotencyKey(key: string): boolean {
    const ts = this.idempotencyCache.get(key);
    if (ts === undefined) return false;
    if (Date.now() - ts >= IDEMPOTENCY_CACHE_TTL_MS) {
      this.idempotencyCache.delete(key);
      return false;
    }
    return true;
  }

  // ---- Internals: Cleanup -------------------------------------------------

  private abortConnection(err: Error): void {
    console.error('[Gateway] Aborting connection:', err.message);
    this.clearHandshake(err);
    this.rejectAllPending(err);
    this.releaseLeadership();

    if (this.ws) {
      this.ws.close(4000, err.message.slice(0, 120));
      this.ws = null;
    }

    this.setState('error');
  }

  private clearHandshake(err?: Error): void {
    if (this.handshakeTimer !== null) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
    if (err && this.handshakeReject) {
      this.handshakeReject(err);
    } else if (!err && this.handshakeResolve) {
      this.handshakeResolve();
    }
    this.handshakeResolve = null;
    this.handshakeReject = null;
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }

  // ---- Leader Election ----------------------------------------------------

  /**
   * Try to claim leadership for this tab/window using BroadcastChannel.
   *
   * Uses deterministic tie-breaking: all contenders broadcast their UUID
   * during a claim window; the lowest UUID wins. The loser becomes a
   * follower that watches for leader heartbeats and promotes itself if
   * the leader disappears (missed heartbeat threshold).
   *
   * Returns true if this tab becomes the leader.
   * Returns false if another tab wins or is already leading.
   *
   * Gracefully returns true when BroadcastChannel is unavailable
   * (older browsers, iOS WKWebView) so the connection always proceeds.
   */
  private async tryClaimLeadership(): Promise<boolean> {
    if (typeof BroadcastChannel === 'undefined') {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let channel: BroadcastChannel;
      try {
        channel = new BroadcastChannel(LEADER_CHANNEL_NAME);
      } catch {
        resolve(true);
        return;
      }

      let existingLeaderSeen = false;
      const competingIds = new Set<string>([this._contenderId]);

      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; id?: string };
        if (!data?.type) return;

        if (data.type === 'heartbeat') {
          // An established leader is already running
          existingLeaderSeen = true;
        } else if (data.type === 'claim' && data.id && data.id !== this._contenderId) {
          // Another tab is also trying to claim
          competingIds.add(data.id);
        }
      };

      // Broadcast our claim and a ping to flush existing leaders
      try {
        channel.postMessage({ type: 'ping' });
        channel.postMessage({ type: 'claim', id: this._contenderId });
      } catch {
        channel.close();
        resolve(true);
        return;
      }

      // After the claim window, determine the winner
      setTimeout(() => {
        channel.close();

        if (existingLeaderSeen) {
          // An active leader exists — become follower
          console.log('[Gateway] Existing leader detected — becoming follower');
          this.startFollowerWatchdog();
          resolve(false);
          return;
        }

        // Deterministic tie-break: lowest UUID wins
        const sorted = [...competingIds].sort();
        const winnerId = sorted[0];

        if (winnerId === this._contenderId) {
          // We won — become leader
          this._leaderChannel = new BroadcastChannel(LEADER_CHANNEL_NAME);
          this._leaderChannel.onmessage = (leaderEvent: MessageEvent) => {
            const msg = leaderEvent.data as { type?: string };
            if (msg?.type === 'ping' || msg?.type === 'claim') {
              try {
                this._leaderChannel?.postMessage({ type: 'heartbeat' });
              } catch {
                // Ignore channel write failures
              }
            }
          };
          this._isLeader = true;
          this.startLeaderHeartbeat();
          this.registerBeforeUnloadHandler();
          console.log('[Gateway] Won leader election');
          resolve(true);
        } else {
          // We lost — become follower
          console.log('[Gateway] Lost leader election to', winnerId, '— becoming follower');
          this.startFollowerWatchdog();
          resolve(false);
        }
      }, LEADER_CLAIM_WINDOW_MS);
    });
  }

  private startLeaderHeartbeat(): void {
    this.stopLeaderHeartbeat();
    this._leaderHeartbeatTimer = setInterval(() => {
      if (this._leaderChannel) {
        try {
          this._leaderChannel.postMessage({ type: 'heartbeat' });
        } catch {
          // Channel may have been closed
        }
      }
    }, LEADER_HEARTBEAT_INTERVAL_MS);
  }

  private stopLeaderHeartbeat(): void {
    if (this._leaderHeartbeatTimer !== null) {
      clearInterval(this._leaderHeartbeatTimer);
      this._leaderHeartbeatTimer = null;
    }
  }

  /**
   * Follower watchdog: keep a BroadcastChannel open to watch for leader
   * heartbeats. If the leader goes silent (missed heartbeat threshold),
   * promote ourselves to leader and open a WebSocket.
   */
  private startFollowerWatchdog(): void {
    this.stopFollowerWatchdog();
    this._missedHeartbeats = 0;

    // Open a channel to listen for heartbeats
    try {
      this._leaderChannel = new BroadcastChannel(LEADER_CHANNEL_NAME);
    } catch {
      return;
    }

    this._leaderChannel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string };
      if (data?.type === 'heartbeat') {
        this._missedHeartbeats = 0;
      } else if (data?.type === 'leader-release') {
        // Leader gracefully released — promote immediately
        console.log('[Gateway] Leader released — promoting to leader');
        this.promoteToLeader();
      }
    };

    // Check for missed heartbeats at the heartbeat interval
    this._followerWatchdogTimer = setInterval(() => {
      this._missedHeartbeats++;
      if (this._missedHeartbeats >= LEADER_MISSED_HEARTBEATS_THRESHOLD) {
        console.log(
          `[Gateway] Leader missed ${this._missedHeartbeats} heartbeats — promoting to leader`
        );
        this.promoteToLeader();
      }
    }, LEADER_HEARTBEAT_INTERVAL_MS);
  }

  private stopFollowerWatchdog(): void {
    if (this._followerWatchdogTimer !== null) {
      clearInterval(this._followerWatchdogTimer);
      this._followerWatchdogTimer = null;
    }
    this._missedHeartbeats = 0;
  }

  /**
   * Promote from follower to leader: clean up follower state, claim
   * leadership, and trigger a reconnect with a small jitter to avoid
   * thundering herd if multiple followers detect the same leader death.
   */
  private promoteToLeader(): void {
    this.stopFollowerWatchdog();

    // Close existing follower channel before opening leader channel
    if (this._leaderChannel) {
      try {
        this._leaderChannel.onmessage = null;
        this._leaderChannel.close();
      } catch {
        /* ignore */
      }
      this._leaderChannel = null;
    }

    // Generate a new contender ID for the next election
    this._contenderId = crypto.randomUUID();

    // Jitter (0-500ms) to avoid thundering herd
    const jitter = Math.floor(Math.random() * 500);
    setTimeout(() => {
      // Re-run leader election — if another follower already won, we'll defer
      void this.tryClaimLeadership().then((isLeader) => {
        if (isLeader) {
          // We are now the leader — trigger a connect
          console.log('[Gateway] Promoted to leader — connecting');
          void this.connect();
        }
      });
    }, jitter);
  }

  private registerBeforeUnloadHandler(): void {
    if (this._beforeUnloadHandler) return;
    this._beforeUnloadHandler = () => {
      if (this._leaderChannel && this._isLeader) {
        try {
          this._leaderChannel.postMessage({ type: 'leader-release' });
        } catch {
          // Ignore — we're unloading anyway
        }
      }
      this.releaseLeadership();
    };
    window.addEventListener('beforeunload', this._beforeUnloadHandler, { once: true });
  }

  private releaseLeadership(): void {
    this.stopLeaderHeartbeat();
    this.stopFollowerWatchdog();
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    if (this._leaderChannel) {
      try {
        this._leaderChannel.onmessage = null;
        this._leaderChannel.close();
      } catch {
        /* ignore */
      }
      this._leaderChannel = null;
    }
    this._isLeader = false;
  }

  // ---- Destroy ------------------------------------------------------------

  /**
   * Full teardown. Disconnects, clears all listeners and subscriptions.
   * The client instance should not be reused after calling destroy().
   */
  destroy(): void {
    this.releaseLeadership();
    this.disconnect();
    this.stopWatchdog();
    this.removeVisibilityListener();
    // Cancel any pending rate-limit drain timer and flush waiting resolvers
    if (this._rlDrainTimer !== null) {
      clearTimeout(this._rlDrainTimer);
      this._rlDrainTimer = null;
    }
    // Resolve queued rate-limit waiters so they don't leak
    for (const resolve of this._rlQueue) resolve();
    this._rlQueue = [];
    this.eventHandlers.clear();
    this.wildcardHandlers.clear();
    this.stateListeners.clear();
    this.idempotencyCache.clear();
    this._snapshot = null;
  }
}
