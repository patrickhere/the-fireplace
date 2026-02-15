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

<!-- Add mistakes and fixes here as they happen. Format: -->
<!-- - **Problem**: what went wrong → **Fix**: what to do instead -->

## Gateway Gotchas

- The raw Tailscale IP (100.90.89.126:18789) does NOT work — gateway binds to loopback only
- All remote access must go through Tailscale Serve (`wss://patricks-macmini.pangolin-typhon.ts.net/`)
- Local dev can use `ws://127.0.0.1:18789`
- Protocol version is 3 — always set `minProtocol: 3, maxProtocol: 3`
- Server sends `connect.challenge` first, then client responds with `connect`
- Tailscale identity headers handle auth — no token needed when connecting via Tailscale Serve
