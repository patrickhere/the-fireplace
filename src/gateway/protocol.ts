// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Frame Builders & Helpers
// ---------------------------------------------------------------------------

import { invoke } from '@tauri-apps/api/core';
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
    locale: navigator.language || 'en-US',
    userAgent: `${clientInfo.id}/${clientInfo.version}`,
  };
}

// ---- Device Identity Helpers (Ed25519, Rust-backed) -----------------------
//
// The Ed25519 private key lives exclusively in the Rust backend (macOS/iOS
// Keychain). JavaScript never sees the private key — only the resulting
// signature and the public key cross the Rust/JS boundary via Tauri invoke.

/**
 * Build the device authentication payload matching OpenClaw's format.
 * The payload is a pipe-delimited string that gets signed in Rust.
 */
function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce?: string;
}): string {
  const version = params.nonce ? 'v2' : 'v1';
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';

  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];

  if (version === 'v2') {
    base.push(params.nonce ?? '');
  }

  return base.join('|');
}

/**
 * Get the device ID (SHA-256 of public key, hex-encoded).
 * Delegates to Rust — no private key ever touches JavaScript.
 */
export async function getDeviceId(): Promise<string> {
  return invoke<string>('get_device_id');
}

/**
 * Build a ConnectDevice for the handshake with proper Ed25519 signing.
 * Signing is performed in Rust; only the signature string is returned to JS.
 * Matches OpenClaw's exact device identity format and verification.
 */
export async function buildDeviceIdentity(
  nonce: string,
  clientInfo: ConnectClientInfo,
  role: string,
  scopes: string[],
  authToken?: string,
  deviceId?: string
): Promise<ConnectDevice> {
  // If deviceId is already known, only fetch the public key to avoid a redundant invoke
  let resolvedDeviceId: string;
  let publicKey: string;
  if (deviceId) {
    resolvedDeviceId = deviceId;
    publicKey = await invoke<string>('get_device_public_key');
  } else {
    // Both calls hit the Rust backend — keypair lives in the Keychain
    const [id, pk] = await Promise.all([
      invoke<string>('get_device_id'),
      invoke<string>('get_device_public_key'),
    ]);
    resolvedDeviceId = id;
    publicKey = pk;
  }

  const signedAt = Date.now();

  // Build the payload string (same logic as before, public data only)
  const payload = buildDeviceAuthPayload({
    deviceId: resolvedDeviceId,
    clientId: clientInfo.id,
    clientMode: clientInfo.mode,
    role,
    scopes,
    signedAtMs: signedAt,
    token: authToken ?? null,
    nonce,
  });

  // Sign in Rust — private key never leaves the Keychain
  const signature = await invoke<string>('sign_payload', { payload });

  return {
    id: resolvedDeviceId,
    publicKey,
    signature,
    signedAt,
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
    displayName: 'The Fireplace',
    deviceFamily: platform === 'macos' ? 'Mac' : 'iPhone',
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
