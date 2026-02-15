---
name: deploy
description: Package and distribute The Fireplace app. Handles macOS DMG creation, code signing, notarization, and iOS App Store preparation.
allowed-tools: Bash, Read, Grep, Edit
---

Deploy The Fireplace:

## macOS Distribution

### 1. Build Release
```bash
pnpm tauri build
```

### 2. Code Signing (requires Apple Developer account)
Tauri handles signing automatically if configured in `tauri.conf.json`:
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: ...",
      "entitlements": "Entitlements.plist"
    }
  }
}
```

### 3. Notarization
```bash
xcrun notarytool submit src-tauri/target/release/bundle/dmg/The\ Fireplace.dmg \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_SPECIFIC_PASSWORD" \
  --wait
```

### 4. Staple
```bash
xcrun stapler staple src-tauri/target/release/bundle/dmg/The\ Fireplace.dmg
```

## iOS Distribution

### 1. Build
```bash
pnpm tauri ios build
```

### 2. Archive in Xcode
- Open `src-tauri/gen/apple/` in Xcode
- Product → Archive
- Distribute App → App Store Connect (or Ad Hoc for testing)

## Auto-Update (macOS)

If `tauri-plugin-updater` is configured:
1. Build the release
2. Upload the bundle to your update server / GitHub Releases
3. Update the endpoint JSON with the new version info

## Checklist

- [ ] Version bumped in `tauri.conf.json` and `package.json`
- [ ] Changelog updated
- [ ] Release build compiles clean
- [ ] App launches and connects to gateway
- [ ] Code signed and notarized (macOS)
- [ ] DMG tested on a clean machine
