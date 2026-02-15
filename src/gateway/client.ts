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
  generateIdempotencyKey,
  isValidFrame,
  getOrCreateDeviceId,
} from './protocol';
import { retrieveDeviceToken, storeDeviceToken } from '@/lib/keychain';

// ---- Constants ------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_MIN_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const IDEMPOTENCY_CACHE_MAX = 500;
const IDEMPOTENCY_CACHE_TTL_MS = 5 * 60_000;

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

// ---- Idempotency Cache Entry ----------------------------------------------

interface IdempotencyCacheEntry {
  key: string;
  timestamp: number;
}

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
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private _lastTickSentAt = 0;
  private _lastTickReceivedAt = 0;

  // -- Idempotency key tracking
  private idempotencyCache: IdempotencyCacheEntry[] = [];

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
    if (
      this._state === 'connected' ||
      this._state === 'connecting' ||
      this._state === 'authenticating'
    ) {
      console.warn('[Gateway] Already connected or connecting -- ignoring connect()');
      return;
    }

    this.intentionalClose = false;
    this.cancelReconnectTimer();
    this._lastError = null;

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
        this.handleMessage(event.data as string);
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
    this.stopTick();

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
   * For side-effecting methods (chat.send, config.apply, etc.), an idempotency
   * key is automatically generated if one is not provided in the options.
   * The key is injected as `idempotencyKey` on the params object (matching the
   * server schema where it is a top-level required field on the params).
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
      // Handle external abort
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(new Error(`Request aborted: ${method}`));
          return;
        }
        const onAbort = () => {
          const pending = this.pendingRequests.get(frame.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(frame.id);
            reject(new Error(`Request aborted: ${method}`));
          }
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      const timer = setTimeout(() => {
        this.pendingRequests.delete(frame.id);
        reject(new Error(`Request timeout after ${timeoutMs}ms: ${method} (id=${frame.id})`));
      }, timeoutMs);

      this.pendingRequests.set(frame.id, {
        method,
        resolve: resolve as (payload: unknown) => void,
        reject,
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
          `[Gateway] Event sequence gap: expected ${this._lastSeq + 1}, got ${frame.seq}`
        );
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

    // Build device identity using the challenge nonce (now async with real crypto)
    const device = await buildDeviceIdentity(challenge.nonce);
    const deviceId = device.id;

    // Try to retrieve stored device token from keychain
    let authToken: string | undefined;
    try {
      const storedToken = await retrieveDeviceToken(deviceId, this.config.url);
      authToken = storedToken.token;
      console.log('[Gateway] Using stored device token from keychain');
    } catch (err) {
      // Token not found or keychain access failed -- proceed without token
      console.log('[Gateway] No stored device token found, proceeding with device pairing');
    }

    const connectParams = buildConnectParams(
      this.config.clientInfo,
      device,
      ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals'],
      authToken
    );

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
      const deviceId = getOrCreateDeviceId();
      storeDeviceToken(
        deviceId,
        this.config.url,
        payload.auth.deviceToken,
        payload.auth.role,
        payload.auth.scopes,
        payload.auth.issuedAtMs ?? Date.now()
      ).catch((err) => {
        // Log keychain storage errors but do not fail the connection
        console.warn('[Gateway] Failed to store device token in keychain:', err);
      });
    }

    // Reset reconnect state on successful connection
    this.reconnect.attempts = 0;
    this.reconnect.nextDelayMs = this.config.reconnectMinMs;

    // Start tick watchdog
    this.startTick();

    // Mark connected
    this.setState('connected');

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

  /**
   * Start the tick watchdog timer based on the server's policy.tickIntervalMs.
   *
   * Sends a lightweight `tick` request at the specified interval to keep the
   * connection alive and signal liveness to the server.
   */
  private startTick(): void {
    this.stopTick();
    const intervalMs = this._serverPolicy?.tickIntervalMs;
    if (!intervalMs || intervalMs <= 0) return;

    this.tickTimer = setInterval(() => {
      if (this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
        this._lastTickSentAt = Date.now();
        // Send tick as a fire-and-forget request. We do not register it as
        // a pending request to avoid timeout noise on keepalive frames.
        const frame = buildRequestFrame('tick');
        try {
          this.send(frame);
        } catch (err) {
          console.warn('[Gateway] Failed to send tick:', err);
        }
      }
    }, intervalMs);

    console.log(`[Gateway] Tick watchdog started: interval=${intervalMs}ms`);
  }

  private stopTick(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** Timestamp (ms since epoch) of the last tick sent. */
  get lastTickSentAt(): number {
    return this._lastTickSentAt;
  }

  /** Timestamp (ms since epoch) of the last tick event received from server. */
  get lastTickReceivedAt(): number {
    return this._lastTickReceivedAt;
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
    this.ws = null;
    this.stopTick();

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
    this.idempotencyCache = this.idempotencyCache.filter(
      (entry) => now - entry.timestamp < IDEMPOTENCY_CACHE_TTL_MS
    );

    // Evict oldest if at capacity
    if (this.idempotencyCache.length >= IDEMPOTENCY_CACHE_MAX) {
      this.idempotencyCache.splice(0, this.idempotencyCache.length - IDEMPOTENCY_CACHE_MAX + 1);
    }

    this.idempotencyCache.push({ key, timestamp: now });
  }

  /**
   * Check if an idempotency key has been used recently.
   */
  private hasIdempotencyKey(key: string): boolean {
    const now = Date.now();
    return this.idempotencyCache.some(
      (entry) => entry.key === key && now - entry.timestamp < IDEMPOTENCY_CACHE_TTL_MS
    );
  }

  // ---- Internals: Cleanup -------------------------------------------------

  private abortConnection(err: Error): void {
    console.error('[Gateway] Aborting connection:', err.message);
    this.clearHandshake(err);
    this.rejectAllPending(err);
    this.stopTick();

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

  // ---- Destroy ------------------------------------------------------------

  /**
   * Full teardown. Disconnects, clears all listeners and subscriptions.
   * The client instance should not be reused after calling destroy().
   */
  destroy(): void {
    this.disconnect();
    this.eventHandlers.clear();
    this.wildcardHandlers.clear();
    this.stateListeners.clear();
    this.idempotencyCache = [];
    this._snapshot = null;
  }
}
