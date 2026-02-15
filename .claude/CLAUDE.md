# The Fireplace — Project Memory

## What This Is

A native macOS + iOS app (Tauri v2 + React 19) that replaces OpenClaw's Control UI and TUI. Connects to the OpenClaw gateway over WebSocket.

## Tech Stack

- **Shell**: Tauri v2 (macOS + iOS)
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **State**: Zustand
- **Build**: Vite + pnpm
- **Gateway**: `wss://patricks-macmini.pangolin-typhon.ts.net/` (Tailscale Serve)

## Project Conventions

### Code Style
- Use `pnpm format` to format code (Prettier)
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Prefer named exports over default exports
- Use `type` imports for type-only imports: `import type { Foo } from './bar'`
- Tailwind classes: use the project design system colors (zinc/amber), never raw hex

### File Organization
- Views go in `src/views/` — one file per view
- Zustand stores go in `src/stores/` — one file per domain
- Reusable components go in `src/components/`
- shadcn/ui components go in `src/components/ui/`
- Gateway protocol code goes in `src/gateway/`
- Hooks go in `src/hooks/`
- Icons/assets go in `src-tauri/icons/` and `public/`

### Component Patterns
- Functional components only — no class components
- Use Zustand hooks directly in components, no prop drilling for global state
- Destructure store values at the top of the component
- Keep components focused — split if over ~200 lines

### Gateway Protocol
- Always verify method names and param shapes against OpenClaw source before implementing
- Use the `/protocol-check` skill when adding new gateway methods
- Idempotency keys required for side-effecting methods (chat.send, config.apply, etc.)
- Never hardcode the gateway URL — use the connection store

### Design System
- Dark mode only — no light theme
- Use the `/design` skill for exact color values and component patterns
- zinc for grays, amber for accent — never blue, never slate, never gray-*
- Dense layouts — `p-2`/`p-3` padding, not `p-6`
- Status dots: emerald=connected, amber=warning, red=error, zinc=offline

### Branding & Icons
- Flame icon with amber/orange gradient (aligns with "Fireplace" name)
- Master SVG sources in `src-tauri/icons/` — never edit PNGs directly
- Regenerate all sizes with `./scripts/regenerate-icons.sh`
- Menu bar icons are template images (black with alpha) for proper macOS rendering
- See `docs/ICONS.md` for full icon documentation

### Testing
- Test gateway connection changes with `/dev` before committing
- Use `/build` to verify release builds compile clean

## Learnings

### Ed25519 Configuration (Feb 2026)

- **Problem**: `code=4000 reason=hashes.sha512 not set` when connecting to gateway
- **Root Cause**: @noble/ed25519 v3.x requires explicit SHA-512 configuration for sync operations
- **Fix**: Install `@noble/hashes` and configure at module init:
  ```typescript
  import * as ed25519 from '@noble/ed25519';
  import { sha512 } from '@noble/hashes/sha512';
  ed25519.hashes.sha512 = sha512; // Must happen before any ed25519 operations
  ```

### Device Signature Payload (Feb 2026)

- **Problem**: `code=1008 reason=device signature invalid` after fixing Ed25519
- **Root Cause**: Was only signing the nonce, but gateway expects signature over full auth payload
- **Fix**: Sign the complete pipe-delimited payload:
  ```
  v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
  ```
  - Version is "v2" when nonce is present, "v1" otherwise
  - Scopes must be comma-separated (no spaces)
  - Token can be empty string for initial pairing
  - All fields pipe-delimited, signed as UTF-8 bytes

## Gateway Gotchas

- The raw Tailscale IP (100.90.89.126:18789) does NOT work — gateway binds to loopback only
- All remote access must go through Tailscale Serve (`wss://patricks-macmini.pangolin-typhon.ts.net/`)
- Local dev can use `ws://127.0.0.1:18789`
- Protocol version is 3 — always set `minProtocol: 3, maxProtocol: 3`
- Server sends `connect.challenge` first, then client responds with `connect`
- Tailscale identity headers handle auth — no token needed when connecting via Tailscale Serve

### Device Authentication Flow

1. Gateway sends `connect.challenge` with nonce
2. Client gets deviceId from Ed25519 keypair (SHA-256 hash of public key)
3. Client loads stored device token from keychain (if exists)
4. Client builds auth payload: `v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce`
5. Client signs payload with Ed25519 private key → base64-url signature
6. Client sends `connect` request with device identity (id, publicKey, signature, signedAt, nonce)
7. Gateway verifies signature and either:
   - Returns device token if pairing approved
   - Returns `code=1008 reason=pairing required` if not paired yet
8. Admin approves pairing: `openclaw devices list` → `openclaw devices approve <requestId>`
9. Client reconnects, gets device token, stores in keychain for future use
