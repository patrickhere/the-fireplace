// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Frame Builders & Helpers
// ---------------------------------------------------------------------------

import type {
  RequestFrame,
  ConnectParams,
  ConnectClientInfo,
  ConnectDevice,
  GatewayFrame,
} from './types';

// ---- ID Generation --------------------------------------------------------

/** Generate a unique request ID (UUID v4). */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Generate an idempotency key for side-effecting methods. */
export function generateIdempotencyKey(): string {
  return `idem_${crypto.randomUUID()}`;
}

// ---- Frame Builders -------------------------------------------------------

/** Build a request frame ready to send over the wire. */
export function buildRequestFrame(method: string, params?: unknown, id?: string): RequestFrame {
  return {
    type: 'req',
    id: id ?? generateRequestId(),
    method,
    params,
  };
}

/** Build the `connect` request params for the v3 handshake. */
export function buildConnectParams(
  clientInfo: ConnectClientInfo,
  device: ConnectDevice,
  scopes: string[] = ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals'],
  authToken?: string
): ConnectParams {
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: clientInfo,
    role: 'operator',
    scopes,
    auth: authToken ? { token: authToken } : {},
    device,
  };
}

// ---- Device Identity Helpers ----------------------------------------------

/**
 * Generate a persistent device fingerprint.
 *
 * In production this should come from the Tauri keychain so it persists
 * across app restarts. For now we generate a deterministic placeholder
 * based on available browser/webview signals and cache it in localStorage.
 */
export function getOrCreateDeviceFingerprint(): string {
  const STORAGE_KEY = 'openclaw_device_fingerprint';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const fingerprint = `fp_${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEY, fingerprint);
  return fingerprint;
}

/**
 * Build a ConnectDevice for the handshake.
 *
 * Since we authenticate through Tailscale identity headers (no cryptographic
 * nonce signing is needed for Tailscale Serve connections), we provide
 * placeholder values for publicKey and signedNonce. Local loopback connections
 * auto-approve device pairing.
 */
export function buildDeviceIdentity(nonce: string): ConnectDevice {
  return {
    fingerprint: getOrCreateDeviceFingerprint(),
    publicKey: 'tailscale-identity',
    signedNonce: nonce, // Echo the nonce back; Tailscale headers handle auth
  };
}

// ---- Platform Detection (sync, non-hook) ----------------------------------

/**
 * Detect platform synchronously from the user agent.
 * For use outside of React components (e.g. inside GatewayClient).
 */
export function detectPlatform(): 'macos' | 'ios' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) {
    return 'ios';
  }
  if (ua.includes('mac')) {
    return 'macos';
  }
  return 'unknown';
}

/** Build the ConnectClientInfo for this device. */
export function buildClientInfo(): ConnectClientInfo {
  const platform = detectPlatform();
  return {
    id: platform === 'ios' ? 'openclaw-ios' : 'openclaw-macos',
    version: __APP_VERSION__,
    platform,
    mode: 'ui',
  };
}

// ---- Frame Type Guards ----------------------------------------------------

/**
 * Type guard to validate that a parsed JSON value looks like a GatewayFrame.
 * Does not validate every field -- just checks enough to dispatch safely.
 */
export function isValidFrame(value: unknown): value is GatewayFrame {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const t = obj['type'];
  return t === 'req' || t === 'res' || t === 'event';
}

// ---- App Version Constant -------------------------------------------------

/**
 * Injected at build time by Vite's `define` config.
 * Falls back to "0.1.0" during development.
 */
declare const __APP_VERSION__: string;
