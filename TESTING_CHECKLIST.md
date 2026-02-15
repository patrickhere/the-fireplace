# Device Token Persistence - Testing Checklist

## Pre-Test Setup

- [ ] Build succeeds: `pnpm build && cargo build --manifest-path src-tauri/Cargo.toml`
- [ ] Format check passes: `pnpm format`
- [ ] macOS device available for testing
- [ ] OpenClaw gateway running and accessible

## Test 1: First Connection (No Stored Token)

**Objective:** Verify device pairing flow works and token is stored

### Steps:
1. [ ] Clear any existing tokens: Open Keychain Access.app → Search "openclaw" → Delete entries
2. [ ] Launch The Fireplace
3. [ ] Open browser dev console (Cmd+Option+I)
4. [ ] Click "Connect" to gateway

### Expected Results:
- [ ] Console shows: `[Gateway] No stored device token found, proceeding with device pairing`
- [ ] Device pairing approval UI appears in gateway
- [ ] Approve device pairing
- [ ] Console shows: `[Gateway] Handshake complete`
- [ ] Connection status turns green (connected)
- [ ] No console errors related to keychain

### Keychain Verification:
```bash
security find-generic-password -s "com.openclaw.the-fireplace"
```
- [ ] Command finds exactly one entry
- [ ] Entry contains device-token key

## Test 2: Subsequent Connection (Token Exists)

**Objective:** Verify automatic re-authentication using stored token

### Steps:
1. [ ] Quit The Fireplace (Cmd+Q)
2. [ ] Relaunch The Fireplace
3. [ ] Open browser dev console
4. [ ] Click "Connect" to same gateway

### Expected Results:
- [ ] Console shows: `[Gateway] Using stored device token from keychain`
- [ ] NO device pairing approval required
- [ ] Console shows: `[Gateway] Handshake complete`
- [ ] Connection status turns green immediately
- [ ] No console errors

## Test 3: Token Clearing

**Objective:** Verify token deletion and re-pairing flow

### Steps:
1. [ ] While connected, open browser dev console
2. [ ] Execute: `useConnectionStore.getState().clearDeviceToken()`
3. [ ] Verify console shows: `[ConnectionStore] Cleared device token from keychain`
4. [ ] Disconnect from gateway
5. [ ] Reconnect to gateway

### Expected Results:
- [ ] Device pairing approval required again
- [ ] Token successfully deleted from keychain
- [ ] New token stored after re-approval

### Keychain Verification:
```bash
security find-generic-password -s "com.openclaw.the-fireplace"
```
- [ ] Entry exists with new data (check modification date)

## Test 4: Multiple Gateways

**Objective:** Verify tokens are isolated per gateway URL

### Steps:
1. [ ] Connect to gateway A (e.g., `ws://127.0.0.1:18789`)
2. [ ] Verify connection succeeds and token stored
3. [ ] Disconnect
4. [ ] Connect to gateway B (e.g., `wss://other-server.ts.net/`)
5. [ ] Approve new device pairing
6. [ ] Disconnect
7. [ ] Connect back to gateway A

### Expected Results:
- [ ] Gateway A requires pairing first time
- [ ] Gateway B requires pairing (separate token)
- [ ] Gateway A auto-reconnects second time (uses original token)
- [ ] Both tokens stored separately in keychain

### Keychain Verification:
```bash
security find-generic-password -s "com.openclaw.the-fireplace"
```
- [ ] Two entries found (one per gateway)

## Test 5: Keychain Access Failure (Simulated)

**Objective:** Verify graceful fallback when keychain is unavailable

### Steps:
1. [ ] Open Keychain Access.app
2. [ ] Lock the login keychain (File → Lock Keychain "login")
3. [ ] Quit and relaunch The Fireplace
4. [ ] Connect to gateway

### Expected Results:
- [ ] Console may show keychain access warning
- [ ] Device pairing still works (falls back to pairing)
- [ ] Connection succeeds
- [ ] No crashes or unhandled errors

## Test 6: Token Expiry (Server-Side)

**Objective:** Verify expired token handling

### Steps:
1. [ ] Connect and store token
2. [ ] Wait for token to expire (server-side) or manually invalidate
3. [ ] Reconnect to gateway

### Expected Results:
- [ ] Client attempts connection with stored token
- [ ] Server rejects expired token
- [ ] Client falls back to device pairing
- [ ] New token stored after approval

## Test 7: Device ID Persistence

**Objective:** Verify device ID stays consistent across restarts

### Steps:
1. [ ] Connect to gateway
2. [ ] Note device ID in console: `getOrCreateDeviceId()`
3. [ ] Quit app
4. [ ] Relaunch app
5. [ ] Check device ID again

### Expected Results:
- [ ] Device ID is identical before and after restart
- [ ] Stored in localStorage under key `openclaw_device_id`

### Verification:
```javascript
// In dev console:
localStorage.getItem('openclaw_device_id')
```
- [ ] Returns consistent UUID value

## Test 8: Connection Store Integration

**Objective:** Verify Zustand store exposes token clearing

### Steps:
1. [ ] In dev console, execute:
   ```javascript
   const store = useConnectionStore.getState();
   console.log(typeof store.clearDeviceToken);
   ```

### Expected Results:
- [ ] Prints: `function`
- [ ] Method is callable and works as expected

## Test 9: Build Verification

**Objective:** Verify release builds work

### Steps:
1. [ ] Build release: `pnpm tauri build`
2. [ ] Launch built app from `src-tauri/target/release/bundle/`
3. [ ] Test connection flow

### Expected Results:
- [ ] Release build succeeds
- [ ] App launches without errors
- [ ] Token persistence works identically
- [ ] No debug console output in release mode

## Test 10: iOS Testing (If Available)

**Objective:** Verify iOS keychain integration

### Steps:
1. [ ] Build iOS app: `pnpm tauri ios build`
2. [ ] Deploy to physical iOS device
3. [ ] Run connection tests 1-3

### Expected Results:
- [ ] iOS Keychain used instead of macOS Keychain
- [ ] Token persistence works on iOS
- [ ] Biometric protection may be required (iOS default)

## Edge Cases

### Test 11: Corrupt Token Data
1. [ ] Manually corrupt keychain entry
2. [ ] Attempt connection
- [ ] Falls back to device pairing
- [ ] No crash

### Test 12: Network Timeout During Token Retrieval
1. [ ] Disconnect network before connecting
2. [ ] Attempt connection
- [ ] Keychain lookup succeeds but connection fails
- [ ] Error handled gracefully

### Test 13: Rapid Reconnections
1. [ ] Connect → Disconnect → Connect rapidly
- [ ] Token retrieval doesn't race
- [ ] Connection stable

## Acceptance Criteria

**All tests must pass for production deployment:**

- [ ] All 13 tests completed
- [ ] No unhandled exceptions
- [ ] No console errors (warnings acceptable)
- [ ] Tokens persist across restarts
- [ ] Multi-gateway isolation works
- [ ] Graceful fallback on errors
- [ ] Release build works
- [ ] Documentation complete

## Known Issues / Notes

**Document any issues found during testing:**

1. Issue: _______________
   Impact: _______________
   Workaround: _______________

2. Issue: _______________
   Impact: _______________
   Workaround: _______________

## Sign-Off

**Tester:** _______________
**Date:** _______________
**Platform:** macOS ___ / iOS ___
**Gateway Version:** _______________
**App Version:** _______________

**Overall Result:** ☐ PASS  ☐ FAIL  ☐ PASS WITH ISSUES

**Comments:**
