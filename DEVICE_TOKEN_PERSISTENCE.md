# Device Token Persistence Implementation

This document describes the device token persistence and keychain integration added to The Fireplace.

## Overview

Device tokens are now stored securely in the platform-native keychain (macOS Keychain / iOS Keychain) after successful authentication. On subsequent connections, the stored token is automatically retrieved and used for re-authentication, eliminating the need for repeated device pairing approvals.

## Architecture

### Rust Layer (`src-tauri/src/keychain.rs`)

The Rust implementation provides platform-native keychain access:

- **macOS/iOS**: Uses `security-framework` crate to access Keychain Services
- **Other platforms**: Returns `UnsupportedPlatform` error (graceful degradation)

**Key Types:**

- `StoredDeviceToken`: Contains token value, device ID, gateway URL, role, scopes, and timestamps
- `KeychainError`: Typed errors for access denied, not found, invalid data, unsupported platform

**Storage Strategy:**

Tokens are keyed by a combination of device ID and normalized gateway URL:
```
device-token:{device_id}:{normalized_gateway_url}
```

This allows multiple device registrations across different gateway instances.

**Commands:**

- `keychain_store_token`: Store a new token
- `keychain_retrieve_token`: Retrieve an existing token
- `keychain_delete_token`: Delete a token
- `keychain_has_token`: Check if a token exists

### TypeScript Layer (`src/lib/keychain.ts`)

Provides clean TypeScript bindings for the Rust keychain commands:

```typescript
export async function storeDeviceToken(
  deviceId: string,
  gatewayUrl: string,
  token: string,
  role: string,
  scopes: string[],
  issuedAtMs: number
): Promise<void>

export async function retrieveDeviceToken(
  deviceId: string,
  gatewayUrl: string
): Promise<StoredDeviceToken>

export async function deleteDeviceToken(
  deviceId: string,
  gatewayUrl: string
): Promise<void>

export async function hasDeviceToken(
  deviceId: string,
  gatewayUrl: string
): Promise<boolean>
```

### Gateway Integration (`src/gateway/client.ts`)

**Token Retrieval (Before Connect):**

In `handleChallengeAsync()`:
1. Receives `connect.challenge` from server
2. Attempts to retrieve stored device token from keychain
3. If found, includes token in `ConnectParams.auth.token`
4. If not found, proceeds with fresh device pairing

**Token Storage (After Hello-OK):**

In `handleHelloOk()`:
1. Receives `hello-ok` response with `auth.deviceToken`
2. Stores token to keychain with device ID, gateway URL, role, and scopes
3. Logs errors but doesn't fail connection if keychain storage fails

### Connection Store (`src/stores/connection.ts`)

Added `clearDeviceToken()` method for explicit token removal:

```typescript
const connectionStore = useConnectionStore();
await connectionStore.clearDeviceToken();
```

Useful for:
- User-initiated logout
- Switching gateway instances
- Token rotation/expiry handling

## Token Lifecycle

### First Connection (No Stored Token)

```
Client                Gateway               Keychain
  |                      |                      |
  |-- connect.challenge--|                      |
  |                      |                      |
  |-- connect (no token)-|                      |
  |                      |                      |
  |------ hello-ok ------|                      |
  |   (with deviceToken) |                      |
  |                      |                      |
  |-- store token ----------------------->      |
  |                      |                      |
```

### Subsequent Connections (Token Exists)

```
Client                Gateway               Keychain
  |                      |                      |
  |-- connect.challenge--|                      |
  |                      |                      |
  |-- retrieve token -----------------------|   |
  |<-------------------------------------- token|
  |                      |                      |
  |-- connect (w/ token)-|                      |
  |                      |                      |
  |------ hello-ok ------|                      |
  |  (auto-approved)     |                      |
  |                      |                      |
```

## Error Handling

**Keychain Access Failures:**
- Token retrieval errors are caught and logged
- Connection proceeds with device pairing if token retrieval fails
- Token storage errors are logged but don't fail the connection

**Platform Support:**
- Non-Apple platforms return `UnsupportedPlatform` error
- All keychain operations gracefully degrade to no-op on unsupported platforms

**Token Expiry/Rotation:**
- Server validates token age and revokes expired tokens
- Client proceeds with fresh device pairing if token is rejected
- Old token is overwritten with new token after successful pairing

## Security Considerations

**Keychain Access:**
- Uses platform-native access controls (macOS Keychain Access, iOS data protection)
- Tokens are encrypted at rest by the OS
- App-scoped access (tokens only accessible to The Fireplace)

**Token Scope:**
- Tokens are bound to specific device ID + gateway URL pairs
- Multiple gateway instances maintain separate tokens
- Device ID is persistent across app restarts (stored in localStorage)

**Token Validation:**
- Server enforces token expiry and revocation
- Client accepts new tokens from server (supports rotation)
- No client-side expiry checking (delegated to server)

## Testing

**Manual Test Steps:**

1. **First Connection:**
   - Launch app
   - Connect to gateway
   - Verify device pairing approval is required
   - Check console logs for "No stored device token found"
   - Approve pairing
   - Check console logs for token storage success

2. **Second Connection:**
   - Restart app
   - Connect to same gateway
   - Verify no pairing approval required
   - Check console logs for "Using stored device token from keychain"

3. **Token Clearing:**
   - Call `connectionStore.clearDeviceToken()`
   - Reconnect
   - Verify pairing approval is required again

4. **Multiple Gateways:**
   - Connect to gateway A (store token)
   - Switch to gateway B (store different token)
   - Switch back to gateway A (use original token)

**Keychain Verification (macOS):**

```bash
# View stored tokens in Keychain Access.app
security find-generic-password -s "com.openclaw.the-fireplace" -a "device-token:*"
```

## Dependencies

**Rust:**
- `security-framework = "3.0"` - macOS/iOS keychain access
- `thiserror = "2.0"` - Error type derivation

**TypeScript:**
- `@tauri-apps/api` - Core Tauri bindings (already present)

## Files Modified

**New Files:**
- `src-tauri/src/keychain.rs` - Rust keychain module
- `src/lib/keychain.ts` - TypeScript bindings
- `DEVICE_TOKEN_PERSISTENCE.md` - This document

**Modified Files:**
- `src-tauri/Cargo.toml` - Added dependencies
- `src-tauri/src/lib.rs` - Registered keychain commands
- `src/gateway/client.ts` - Token retrieval and storage logic
- `src/gateway/protocol.ts` - Added documentation
- `src/stores/connection.ts` - Added clearDeviceToken method

## Future Enhancements

**Possible improvements:**

1. **Token List Enumeration:**
   - Implement full `list_tokens()` using SecItemCopyMatching FFI
   - Show user which gateways have stored tokens
   - Bulk token clearing

2. **Token Expiry UI:**
   - Parse `issuedAtMs` and show token age in settings
   - Warn users about tokens older than N days
   - Proactive token refresh

3. **Biometric Protection:**
   - Require Touch ID / Face ID before retrieving tokens
   - Set `kSecAttrAccessControl` with biometric flags

4. **Token Rotation:**
   - Periodic automatic token refresh
   - Server-initiated token rotation events

5. **Cross-Platform Support:**
   - Windows: Use Windows Credential Manager
   - Linux: Use Secret Service API (libsecret)
   - Web: Encrypted localStorage with Web Crypto API

## Troubleshooting

**"Keychain access denied":**
- Check app entitlements (`src-tauri/gen/apple/*.entitlements`)
- Verify Keychain Access permissions in System Preferences

**"Token not found" on reconnect:**
- Check device ID hasn't changed (localStorage cleared)
- Verify gateway URL matches exactly (protocol + host + port)
- Check keychain for stored entries (see Keychain Verification above)

**Tokens not persisting across restarts:**
- Ensure `localStorage` is not being cleared
- Check browser/webview privacy settings
- Verify Tauri data directory permissions
