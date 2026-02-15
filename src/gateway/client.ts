// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 — GatewayClient
// ---------------------------------------------------------------------------

import type {
  GatewayFrame,
  ResponseFrame,
  EventFrame,
  ConnectChallengePayload,
  HelloOkPayload,
  GatewayConnectionState,
  GatewayPolicy,
  StateVersion,
  EventHandler,
  Unsubscribe,
  RequestOptions,
  PendingRequest,
  GatewayClientConfig,
  ReconnectState,
  GatewayError,
} from './types';
import {
  buildRequestFrame,
  buildConnectParams,
  buildClientInfo,
  buildDeviceIdentity,
  generateIdempotencyKey,
} from './protocol';

// ---- Constants ------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_MIN_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;

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

  // -- Handshake
  private handshakeResolve: (() => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Server info (populated after hello-ok)
  private _serverPolicy: GatewayPolicy | null = null;
  private _serverFeatures: string[] = [];
  private _serverVersion: string | null = null;
  private _serverId: string | null = null;
  private _authToken: string | null = null;

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

  get serverPolicy(): GatewayPolicy | null {
    return this._serverPolicy;
  }

  get serverFeatures(): string[] {
    return this._serverFeatures;
  }

  get serverVersion(): string | null {
    return this._serverVersion;
  }

  get serverId(): string | null {
    return this._serverId;
  }

  /** Auth token returned by the server during handshake, if any. */
  get authToken(): string | null {
    return this._authToken;
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
   * Resolves when the handshake completes (hello-ok received).
   * Rejects if the WebSocket fails to open or the handshake times out.
   */
  async connect(urlOverride?: string): Promise<void> {
    if (
      this._state === 'connected' ||
      this._state === 'connecting' ||
      this._state === 'authenticating'
    ) {
      console.warn('[Gateway] Already connected or connecting — ignoring connect()');
      return;
    }

    this.intentionalClose = false;
    this.cancelReconnectTimer();

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

      // Handshake timeout — if server never sends challenge or hello-ok
      this.handshakeTimer = setTimeout(() => {
        this.handshakeTimer = null;
        const err = new Error('Handshake timeout: server did not complete v3 handshake');
        this.abortConnection(err);
      }, HANDSHAKE_TIMEOUT_MS);

      this.ws.onopen = () => {
        console.log('[Gateway] WebSocket transport open, awaiting connect.challenge...');
        // Do NOT resolve here — we wait for the full handshake
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onerror = (event: Event) => {
        console.error('[Gateway] WebSocket error:', event);
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

    const frame = buildRequestFrame(method, params);
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;

    // Inject idempotency key into params if provided or if it is a
    // side-effecting method
    if (options?.idempotencyKey && typeof frame.params === 'object' && frame.params !== null) {
      (frame.params as Record<string, unknown>)._idempotencyKey = options.idempotencyKey;
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
   * Convenience: send a side-effecting request with an auto-generated
   * idempotency key.
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

  // ---- Internals: Message Handling ----------------------------------------

  private handleMessage(raw: string): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw) as GatewayFrame;
    } catch (err) {
      console.error('[Gateway] Failed to parse incoming frame:', err);
      return;
    }

    switch (frame.type) {
      case 'res':
        this.handleResponse(frame);
        break;
      case 'event':
        this.handleEvent(frame);
        break;
      case 'req':
        // Server-initiated requests are not expected in v3 from the client side.
        console.warn('[Gateway] Received unexpected server-initiated request:', frame);
        break;
      default:
        console.warn('[Gateway] Unknown frame type:', frame);
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

  private handleChallenge(challenge: ConnectChallengePayload): void {
    console.log(
      `[Gateway] Received connect.challenge: nonce=${challenge.nonce} ts=${challenge.ts}`
    );
    this.setState('challenged');

    const clientInfo = this.config.clientInfo ?? buildClientInfo();
    const device = this.config.device ?? buildDeviceIdentity(challenge.nonce);

    // If device was configured without knowing the nonce, patch it now
    if (device.signedNonce === '' || device.signedNonce === 'pending') {
      device.signedNonce = challenge.nonce;
    }

    const connectParams = buildConnectParams(clientInfo, device);

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

  private handleHelloOk(payload: HelloOkPayload): void {
    if (payload.type !== 'hello-ok') {
      const err = new Error(`Expected hello-ok, got: ${payload.type}`);
      this.abortConnection(err);
      return;
    }

    console.log(
      `[Gateway] Handshake complete: protocol=${payload.protocol} features=[${payload.features.join(', ')}]`
    );

    // Store server info
    this._serverPolicy = payload.policy;
    this._serverFeatures = payload.features;
    this._serverVersion = payload.version ?? null;
    this._serverId = payload.serverId ?? null;
    if (payload.auth?.token) {
      this._authToken = payload.auth.token;
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

  // ---- Internals: Tick / Watchdog -----------------------------------------

  private startTick(): void {
    this.stopTick();
    const intervalMs = this._serverPolicy?.tickIntervalMs;
    if (!intervalMs || intervalMs <= 0) return;

    this.tickTimer = setInterval(() => {
      // Send a lightweight ping/tick to keep the connection alive
      // The protocol uses a "tick" request that the server expects
      // at the specified interval
      if (this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
        this.send(buildRequestFrame('tick'));
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

  private scheduleReconnect(): void {
    this.setState('reconnecting');

    const delay = this.reconnect.nextDelayMs;
    this.reconnect.attempts += 1;

    // Exponential backoff with jitter
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
        // handleClose will be called by WebSocket close, which schedules the next retry
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
  }
}
