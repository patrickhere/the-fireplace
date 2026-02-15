# The Fireplace - Scaffold Complete

This document describes the complete Tauri v2 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui scaffold that has been created.

## What's Been Set Up

### Core Infrastructure

- **Package Manager**: pnpm with all dependencies installed
- **Build System**: Vite 6 with React 19 and TypeScript 5.7
- **Styling**: Tailwind CSS v4 with custom dark amber theme
- **Components**: shadcn/ui configured (components not yet installed)
- **State Management**: Zustand 5 (store scaffolds created)
- **Routing**: React Router 7 with all views registered
- **Tauri**: v2.10 configured for macOS + iOS targets

### TypeScript Configuration

- Strict mode enabled
- Path aliases configured (`@/*` maps to `./src/*`)
- No implicit any, no unused locals/parameters
- Proper type checking for all files

### Project Structure

```
the-fireplace/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (empty, ready for installation)
│   │   ├── Sidebar.tsx            # macOS sidebar navigation
│   │   ├── MobileNav.tsx          # iOS bottom tab navigation
│   │   └── ConnectionStatus.tsx   # Gateway connection indicator
│   ├── gateway/
│   │   ├── client.ts              # GatewayClient class (basic WebSocket wrapper)
│   │   └── types.ts               # Protocol type definitions
│   ├── hooks/
│   │   └── usePlatform.ts         # macOS vs iOS detection hook
│   ├── lib/
│   │   └── utils.ts               # cn() utility for class merging
│   ├── stores/
│   │   └── connection.ts          # Connection state store (scaffold only)
│   ├── styles/
│   │   └── globals.css            # Tailwind v4 + theme configuration
│   ├── views/                     # All 13 views (placeholders)
│   │   ├── Chat.tsx
│   │   ├── Sessions.tsx
│   │   ├── Channels.tsx
│   │   ├── Agents.tsx
│   │   ├── Config.tsx
│   │   ├── Approvals.tsx
│   │   ├── Cron.tsx
│   │   ├── Skills.tsx
│   │   ├── Devices.tsx
│   │   ├── Logs.tsx
│   │   ├── Models.tsx
│   │   ├── Usage.tsx
│   │   └── More.tsx
│   ├── App.tsx                    # Root component with routing
│   └── main.tsx                   # React entry point
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                 # Shared Tauri library
│   │   ├── main.rs                # Desktop entry point
│   │   └── build.rs               # Build script
│   ├── icons/                     # Generated placeholder icons
│   ├── Cargo.toml                 # Rust dependencies
│   └── tauri.conf.json            # Tauri configuration
├── scripts/
│   └── generate-icons.py          # Icon generation utility
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json                # shadcn/ui configuration
└── .prettierrc                    # Code formatting rules
```

## Theme Configuration

The dark amber theme is pre-configured in `src/styles/globals.css`:

- **Background**: zinc-950 (#09090b)
- **Cards/Panels**: zinc-900 (#18181b)
- **Borders**: zinc-700 (#3f3f46)
- **Accent**: amber-500 (#f59e0b)
- **Text**: zinc-100 (primary), zinc-400 (secondary)
- **Status Colors**: emerald (success), amber (warning), red (error), zinc (offline)

## Navigation Structure

### macOS (Sidebar)
- Fixed left sidebar (240px wide)
- All 12 main views accessible
- Connection status at bottom

### iOS (Bottom Tabs)
- 5 primary tabs: Chat, Sessions, Channels, Agents, More
- "More" tab contains overflow views
- 56px bottom navigation bar

## What Works Now

1. **TypeScript compilation** - `pnpm exec tsc --noEmit` passes
2. **Vite build** - `pnpm build` produces optimized bundle
3. **Rust compilation** - `cargo check` in src-tauri/ succeeds
4. **Routing** - All 13 views are registered and accessible
5. **Platform detection** - `usePlatform()` hook detects macOS vs iOS
6. **Responsive layout** - Sidebar on desktop, bottom nav on mobile

## What's Not Implemented Yet

1. **Gateway Protocol** - `GatewayClient` is a skeleton, needs full v3 handshake
2. **Zustand Stores** - Only `connectionStore` scaffold exists
3. **shadcn/ui Components** - Config is ready, but no components installed yet
4. **Tauri Commands** - Only a demo `greet` command exists
5. **iOS Mobile Build** - Xcode project not yet generated (requires `pnpm tauri ios init`)
6. **Icons** - Placeholder icons only, need proper app icons
7. **View Content** - All views show "coming soon" placeholders

## Next Steps

### Phase 1: Gateway Connection
```bash
# Implement full protocol v3 handshake in src/gateway/client.ts
# - Challenge/response
# - Connect with minProtocol/maxProtocol
# - Hello-ok parsing
# - Event subscription
# - Auto-reconnect with backoff
```

### Phase 2: Install shadcn/ui Components
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add card
# etc.
```

### Phase 3: Build First View (Chat)
```bash
# Implement src/views/Chat.tsx
# Create src/stores/chat.ts
# Add message rendering, input, streaming
```

### Phase 4: Initialize iOS Target
```bash
pnpm tauri ios init
# Follow Tauri docs to configure Xcode project
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Type check
pnpm exec tsc --noEmit

# Format code
pnpm format

# Build frontend only
pnpm build

# Dev mode (Vite only, no Tauri window)
pnpm dev

# Tauri dev (opens native window)
pnpm tauri dev

# Check Rust compilation
cargo check --manifest-path=src-tauri/Cargo.toml

# Generate icons (if needed)
python3 scripts/generate-icons.py
```

## Verification

All checks pass:

- ✅ TypeScript compiles without errors
- ✅ Vite builds successfully
- ✅ Rust compiles without errors
- ✅ All routes registered
- ✅ Theme variables configured
- ✅ Platform detection works
- ✅ Responsive layout structure in place

## Notes

- Icons are placeholders - replace with proper fire emoji or flame icon for production
- Gateway URL is hardcoded in `connectionStore` - make configurable when implementing settings
- All views are basic placeholders - implement according to PLAN.md phases
- Mobile build requires Xcode and iOS simulator/device
- Protocol v3 handshake details should be verified against OpenClaw source

## Dependencies Version Summary

| Package | Version | Notes |
|---------|---------|-------|
| React | 19.2.4 | Latest stable |
| TypeScript | 5.9.3 | Strict mode |
| Vite | 6.4.1 | Fast HMR |
| Tailwind CSS | 4.1.18 | Latest v4 |
| Tauri | 2.10.2 | macOS + iOS support |
| Zustand | 5.0.11 | State management |
| React Router | 7.13.0 | Client-side routing |

---

**Scaffold Date**: 2026-02-15
**Status**: Ready for Phase 1 development
