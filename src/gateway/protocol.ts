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

/**
 * Build the `connect` request params for the v3 handshake.
 *
 * @param clientInfo - Client identity information
 * @param device - Device identity with cryptographic proof
 * @param scopes - Requested scopes (default: full operator permissions)
 * @param authToken - Optional device token from keychain for re-authentication
 */
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
    locale: navigator.language || 'en-US',
    userAgent: `${clientInfo.id}/${clientInfo.version}`,
  };
}

// ---- Device Identity Helpers ----------------------------------------------

/**
 * Generate a persistent device ID (fingerprint).
 *
 * In production this should come from the Tauri keychain so it persists
 * across app restarts. For now we generate a deterministic placeholder
 * based on available browser/webview signals and cache it in localStorage.
 */
export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'openclaw_device_id';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const deviceId = `fp_${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEY, deviceId);
  return deviceId;
}

/**
 * Build a ConnectDevice for the handshake.
 *
 * Since we authenticate through Tailscale identity headers (no cryptographic
 * nonce signing is needed for Tailscale Serve connections), we provide
 * placeholder values for publicKey and signature. Local loopback connections
 * auto-approve device pairing.
 *
 * The device shape matches ConnectParamsSchema.device:
 *   { id, publicKey, signature, signedAt, nonce }
 */
export function buildDeviceIdentity(nonce: string): ConnectDevice {
  return {
    id: getOrCreateDeviceId(),
    publicKey: 'tailscale-identity',
    signature: nonce, // Echo the nonce back; Tailscale headers handle auth
    signedAt: Date.now(),
    nonce,
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
