---
name: dev
description: Start the Tauri development server and verify the app launches correctly.
allowed-tools: Bash, Read, Grep
---

Start the Fireplace in development mode:

1. Ensure dependencies are installed:
   ```bash
   pnpm install
   ```

2. Start Tauri dev server:
   ```bash
   pnpm tauri dev
   ```

3. Verify:
   - The app window opens
   - No Rust compilation errors
   - The React frontend loads in the webview
   - Check the terminal output for any warnings or errors

If there are build errors, read the error output carefully and fix the issue before retrying. Common issues:
- Missing Rust toolchain: `rustup update`
- Missing system dependencies on macOS: `xcode-select --install`
- Node module issues: `pnpm install --force`
