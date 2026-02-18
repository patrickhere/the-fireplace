// ---------------------------------------------------------------------------
// Keychain Integration (TypeScript bindings)
// ---------------------------------------------------------------------------
//
// Provides TypeScript bindings for the Rust keychain commands that store
// device tokens in the platform-native keychain (macOS Keychain / iOS Keychain).

import { invoke } from '@tauri-apps/api/core';

// ---- Types ----------------------------------------------------------------

/** Stored device token with metadata returned from the keychain. */
export interface StoredDeviceToken {
  token: string;
  deviceId: string;
  gatewayUrl: string;
  issuedAtMs: number;
  storedAtMs: number;
  role: string;
  scopes: string[];
}

// ---- Public API -----------------------------------------------------------

/**
 * Store a device token in the platform keychain.
 *
 * @param deviceId - The device ID (fingerprint) this token is bound to
 * @param gatewayUrl - The gateway URL this token was issued for
 * @param token - The device token value (opaque string from the server)
 * @param role - Role granted by the server (e.g. "operator")
 * @param scopes - Scopes granted by the server
 * @param issuedAtMs - Unix timestamp (ms) when the token was issued
 */
export async function storeDeviceToken(
  deviceId: string,
  gatewayUrl: string,
  token: string,
  role: string,
  scopes: string[],
  issuedAtMs: number
): Promise<void> {
  await invoke('keychain_store_token', {
    deviceId,
    gatewayUrl,
    token,
    role,
    scopes,
    issuedAtMs,
  });
}

/**
 * Retrieve a device token from the platform keychain.
 *
 * @param deviceId - The device ID (fingerprint)
 * @param gatewayUrl - The gateway URL
 * @returns The stored device token with metadata
 * @throws If the token is not found or keychain access fails
 */
export async function retrieveDeviceToken(
  deviceId: string,
  gatewayUrl: string
): Promise<StoredDeviceToken> {
  const result = await invoke<Record<string, unknown>>('keychain_retrieve_token', {
    deviceId,
    gatewayUrl,
  });

  // Validate fields before casting to avoid silent type mismatches
  const token = result?.token;
  const rDeviceId = result?.deviceId;
  const rGatewayUrl = result?.gatewayUrl;
  const issuedAtMs = result?.issuedAtMs;
  const storedAtMs = result?.storedAtMs;
  const role = result?.role;
  const scopes = result?.scopes;

  if (typeof token !== 'string' || !token) {
    throw new Error('Keychain result missing or invalid "token" field');
  }
  if (typeof rDeviceId !== 'string' || !rDeviceId) {
    throw new Error('Keychain result missing or invalid "deviceId" field');
  }
  if (typeof rGatewayUrl !== 'string' || !rGatewayUrl) {
    throw new Error('Keychain result missing or invalid "gatewayUrl" field');
  }
  if (typeof issuedAtMs !== 'number') {
    throw new Error('Keychain result missing or invalid "issuedAtMs" field');
  }
  if (typeof storedAtMs !== 'number') {
    throw new Error('Keychain result missing or invalid "storedAtMs" field');
  }
  if (typeof role !== 'string') {
    throw new Error('Keychain result missing or invalid "role" field');
  }
  if (!Array.isArray(scopes)) {
    throw new Error('Keychain result missing or invalid "scopes" field');
  }

  return {
    token,
    deviceId: rDeviceId,
    gatewayUrl: rGatewayUrl,
    issuedAtMs,
    storedAtMs,
    role,
    scopes: scopes as string[],
  };
}

/**
 * Delete a device token from the platform keychain.
 *
 * @param deviceId - The device ID (fingerprint)
 * @param gatewayUrl - The gateway URL
 */
export async function deleteDeviceToken(deviceId: string, gatewayUrl: string): Promise<void> {
  await invoke('keychain_delete_token', {
    deviceId,
    gatewayUrl,
  });
}

/**
 * Check if a device token exists in the platform keychain.
 *
 * @param deviceId - The device ID (fingerprint)
 * @param gatewayUrl - The gateway URL
 * @returns true if the token exists, false otherwise
 */
export async function hasDeviceToken(deviceId: string, gatewayUrl: string): Promise<boolean> {
  try {
    return await invoke<boolean>('keychain_has_token', {
      deviceId,
      gatewayUrl,
    });
  } catch {
    return false;
  }
}
