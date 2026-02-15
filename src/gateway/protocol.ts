// ---------------------------------------------------------------------------
// OpenClaw Gateway Protocol v3 -- Frame Builders & Helpers
// ---------------------------------------------------------------------------

import * as ed25519 from '@noble/ed25519';
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
 * Sign a nonce with the Ed25519 private key.
 * Returns base64-url encoded signature matching OpenClaw's format.
 */
async function signNonceEd25519(nonce: string, privateKey: Uint8Array): Promise<string> {
  const nonceBytes = new TextEncoder().encode(nonce);
  const signature = await ed25519.signAsync(nonceBytes, privateKey);
  return base64UrlEncode(signature);
}

/**
 * Build a ConnectDevice for the handshake with proper Ed25519 signing.
 * Matches OpenClaw's exact device identity format and verification.
 */
export async function buildDeviceIdentity(nonce: string): Promise<ConnectDevice> {
  const { deviceId, publicKey, privateKey } = await getOrCreateEd25519Keypair();
  const signature = await signNonceEd25519(nonce, privateKey);

  return {
    id: deviceId,
    publicKey,
    signature,
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
    mode: 'webchat', // Use webchat mode to avoid hashes.sha512 requirement
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
