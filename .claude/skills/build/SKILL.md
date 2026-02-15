---
name: build
description: Build The Fireplace for macOS and/or iOS release.
allowed-tools: Bash, Read, Grep
---

Build The Fireplace for release:

## macOS Build

```bash
pnpm tauri build
```

The output will be in `src-tauri/target/release/bundle/`:
- `.dmg` — disk image for distribution
- `.app` — application bundle

## iOS Build

```bash
pnpm tauri ios build
```

This generates an Xcode project. For a release build:
1. Open `src-tauri/gen/apple/` in Xcode
2. Set signing team and bundle identifier
3. Archive and distribute

## Verification

After building:
- Check the bundle size is reasonable (target: under 50MB for macOS)
- Open the built `.app` and verify it launches
- Test the WebSocket connection works from the built app
- Verify the dark theme and all views render correctly

## Troubleshooting

- If Rust build fails, check `cargo build --release` separately
- If iOS build fails, ensure Xcode and iOS SDK are installed
- For code signing issues, check `tauri.conf.json` bundle identifier
