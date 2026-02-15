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
 * Generate or retrieve device keypair from localStorage.
 * Uses Ed25519 for signing (via SubtleCrypto).
 */
async function getOrCreateKeypair(): Promise<{
  deviceId: string;
  publicKey: string;
  privateKey: CryptoKey;
}> {
  const DEVICE_ID_KEY = 'openclaw_device_id';
  const PUBLIC_KEY_KEY = 'openclaw_public_key';
  const PRIVATE_KEY_KEY = 'openclaw_private_key_jwk';

  // Check if we have existing keys
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  const existingPublicKey = localStorage.getItem(PUBLIC_KEY_KEY);
  const existingPrivateKeyJwk = localStorage.getItem(PRIVATE_KEY_KEY);

  if (existingDeviceId && existingPublicKey && existingPrivateKeyJwk) {
    try {
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(existingPrivateKeyJwk),
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      );
      return {
        deviceId: existingDeviceId,
        publicKey: existingPublicKey,
        privateKey,
      };
    } catch (err) {
      console.warn('[Protocol] Failed to import existing keypair, generating new one:', err);
    }
  }

  // Generate new keypair using ECDSA P-256 (widely supported)
  const keypair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);

  // Export public key as base64
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keypair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)));

  // Export private key as JWK for storage
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);

  // Generate device ID from public key hash
  const publicKeyHash = await crypto.subtle.digest('SHA-256', publicKeyRaw);
  const deviceId = Array.from(new Uint8Array(publicKeyHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Store in localStorage
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  localStorage.setItem(PUBLIC_KEY_KEY, publicKeyBase64);
  localStorage.setItem(PRIVATE_KEY_KEY, JSON.stringify(privateKeyJwk));

  return {
    deviceId,
    publicKey: publicKeyBase64,
    privateKey: keypair.privateKey,
  };
}

/**
 * Sign a nonce with the device private key.
 */
async function signNonce(nonce: string, privateKey: CryptoKey): Promise<string> {
  const nonceBytes = new TextEncoder().encode(nonce);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    nonceBytes
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Build a ConnectDevice for the handshake with proper cryptographic signing.
 */
export async function buildDeviceIdentity(nonce: string): Promise<ConnectDevice> {
  const { deviceId, publicKey, privateKey } = await getOrCreateKeypair();
  const signature = await signNonce(nonce, privateKey);

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
