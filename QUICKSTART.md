# The Fireplace - Quick Start

## Verify Setup

```bash
# Type check
pnpm exec tsc --noEmit

# Build frontend
pnpm build

# Check Rust
cargo check --manifest-path=src-tauri/Cargo.toml
```

All checks should pass without errors.

## Development

### Start Vite Dev Server (Browser Mode)
```bash
pnpm dev
```
Open http://localhost:1420 in your browser to see the React app.

### Start Tauri Dev (Native Window)
```bash
pnpm tauri dev
```
Opens a native macOS window with the app. Hot reload works for both React and Rust changes.

### Build for Production
```bash
pnpm tauri build
```
Creates a production `.app` bundle in `src-tauri/target/release/bundle/`.

## Next Implementation Steps

### 1. Gateway Connection (Required First)

Edit `/Users/patrick/Documents/projects/the-fireplace/src/gateway/client.ts`:
- Implement protocol v3 handshake (challenge -> connect -> hello-ok)
- Add auto-reconnect with exponential backoff
- Implement event subscription system
- Add request timeout handling

### 2. Install shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add toast
```

### 3. Build First Feature (Chat View)

Edit `/Users/patrick/Documents/projects/the-fireplace/src/views/Chat.tsx`:
- Create chat message list
- Add message input with send button
- Implement streaming response rendering
- Add markdown support for messages

Create `/Users/patrick/Documents/projects/the-fireplace/src/stores/chat.ts`:
- Messages array
- Active session ID
- Streaming state
- Actions: sendMessage, abort, inject

### 4. Test on Device

To run on iOS:
```bash
pnpm tauri ios init
pnpm tauri ios dev
```

Requires Xcode and iOS Simulator or device.

## File Locations

| What | Where |
|------|-------|
| Views | `/Users/patrick/Documents/projects/the-fireplace/src/views/` |
| Components | `/Users/patrick/Documents/projects/the-fireplace/src/components/` |
| Stores | `/Users/patrick/Documents/projects/the-fireplace/src/stores/` |
| Gateway | `/Users/patrick/Documents/projects/the-fireplace/src/gateway/` |
| Hooks | `/Users/patrick/Documents/projects/the-fireplace/src/hooks/` |
| Styles | `/Users/patrick/Documents/projects/the-fireplace/src/styles/globals.css` |
| Tauri Rust | `/Users/patrick/Documents/projects/the-fireplace/src-tauri/src/` |
| Config | `/Users/patrick/Documents/projects/the-fireplace/src-tauri/tauri.conf.json` |

## Troubleshooting

### TypeScript Errors
```bash
pnpm exec tsc --noEmit
```
Fix any errors shown. Common issues:
- Missing imports
- Type mismatches
- Unused variables (if strict mode)

### Build Errors
```bash
pnpm build
```
Ensure Vite config is correct and all imports resolve.

### Rust Errors
```bash
cargo check --manifest-path=src-tauri/Cargo.toml
```
Check Cargo.toml dependencies and Rust syntax.

### Icon Issues
If icon build fails:
```bash
python3 scripts/generate-icons.py
```

## Design System Reference

Use the `/design` skill to check exact color values and component patterns.

Quick reference:
- Background: `bg-zinc-950`
- Cards: `bg-zinc-900 border border-zinc-700 rounded-lg p-3`
- Accent: `text-amber-400`, `bg-amber-500`
- Status: `emerald-500` (ok), `amber-500` (warn), `red-500` (error)

## Getting Help

1. Read PLAN.md for the complete feature roadmap
2. Read SCAFFOLD.md for what's been set up
3. Check .claude/CLAUDE.md for project conventions
4. Use the `/design` skill for UI questions
5. Use the `/protocol-check` skill for gateway method questions

---

Ready to start building!
