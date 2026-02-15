// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Frame Builders & Helpers
// ---------------------------------------------------------------------------

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import type {
  RequestFrame,
  ConnectParams,
  ConnectClientInfo,
  ConnectDevice,
  GatewayFrame,
} from './types';

// Configure ed25519 with SHA-512 before any operations
// This is REQUIRED for @noble/ed25519 v3.x to support synchronous operations
ed25519.hashes.sha512 = sha512;

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

// ---- Device Identity Helpers (Ed25519) ------------------------------------

/**
 * Convert Uint8Array to base64-url encoding (RFC 4648 §5).
 * This matches OpenClaw's base64UrlEncode format.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate or retrieve Ed25519 device keypair from localStorage.
 * Matches OpenClaw's device identity format exactly.
 */
async function getOrCreateEd25519Keypair(): Promise<{
  deviceId: string;
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const DEVICE_ID_KEY = 'openclaw_device_id';
  const PUBLIC_KEY_KEY = 'openclaw_public_key_ed25519';
  const PRIVATE_KEY_KEY = 'openclaw_private_key_ed25519';

  // Check if we have existing keys
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  const existingPublicKey = localStorage.getItem(PUBLIC_KEY_KEY);
  const existingPrivateKey = localStorage.getItem(PRIVATE_KEY_KEY);

  if (existingDeviceId && existingPublicKey && existingPrivateKey) {
    try {
      // Restore private key from hex
      const privateKey = new Uint8Array(
        existingPrivateKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      return {
        deviceId: existingDeviceId,
        publicKey: existingPublicKey,
        privateKey,
      };
    } catch (err) {
      console.warn(
        '[Protocol] Failed to import existing Ed25519 keypair, generating new one:',
        err
      );
    }
  }

  // Generate new Ed25519 keypair
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKeyBytes = await ed25519.getPublicKey(privateKey);

  // Encode public key as base64-url (matching OpenClaw format)
  const publicKey = base64UrlEncode(publicKeyBytes);

  // Derive device ID from SHA-256 hash of public key bytes (as hex)
  const publicKeyHash = await crypto.subtle.digest(
    'SHA-256',
    publicKeyBytes as unknown as BufferSource
  );
  const deviceId = Array.from(new Uint8Array(publicKeyHash))
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');

  // Store in localStorage (private key as hex for easy serialization)
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  localStorage.setItem(PUBLIC_KEY_KEY, publicKey);
  localStorage.setItem(
    PRIVATE_KEY_KEY,
    Array.from(privateKey)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('')
  );

  console.log('[Protocol] Generated new Ed25519 device identity:', {
    deviceId,
    publicKey: publicKey.slice(0, 20) + '...',
  });

  return {
    deviceId,
    publicKey,
    privateKey,
  };
}

/**
 * Build the device authentication payload matching OpenClaw's format.
 * The payload is a pipe-delimited string that gets signed.
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
 * Sign the device auth payload with the Ed25519 private key.
 * Returns base64-url encoded signature matching OpenClaw's format.
 */
async function signDevicePayload(payload: string, privateKey: Uint8Array): Promise<string> {
  const payloadBytes = new TextEncoder().encode(payload);
  const signature = await ed25519.signAsync(payloadBytes, privateKey);
  return base64UrlEncode(signature);
}

/**
 * Get the device ID from the stored or newly generated keypair.
 * This is useful for looking up stored tokens before building the full device identity.
 */
export async function getDeviceId(): Promise<string> {
  const { deviceId } = await getOrCreateEd25519Keypair();
  return deviceId;
}

/**
 * Build a ConnectDevice for the handshake with proper Ed25519 signing.
 * Matches OpenClaw's exact device identity format and verification.
 */
export async function buildDeviceIdentity(
  nonce: string,
  clientInfo: ConnectClientInfo,
  role: string,
  scopes: string[],
  authToken?: string
): Promise<ConnectDevice> {
  const { deviceId, publicKey, privateKey } = await getOrCreateEd25519Keypair();
  const signedAt = Date.now();

  // Build the complete payload that will be signed
  const payload = buildDeviceAuthPayload({
    deviceId,
    clientId: clientInfo.id,
    clientMode: clientInfo.mode,
    role,
    scopes,
    signedAtMs: signedAt,
    token: authToken ?? null,
    nonce,
  });

  // Sign the full payload (not just the nonce!)
  const signature = await signDevicePayload(payload, privateKey);

  return {
    id: deviceId,
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
