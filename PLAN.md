# The Fireplace — Mission Control for OpenClaw

## What This Is

A native macOS + iOS app that fully replaces OpenClaw's built-in Control UI and TUI. The Fireplace is a personal, polished mission control for your OpenClaw gateway and your agent Calcifer — fast, always accessible, and designed for a single operator.

**This is not an MVP — the goal is a complete, production-quality replacement before daily use.**

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| App shell | Tauri v2 (macOS + iOS from one codebase) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State | Zustand |
| Routing | React Router (or TanStack Router) |
| Markdown | react-markdown + rehype |
| Code editor | CodeMirror 6 (for config/file editing) |
| Build | Vite |
| Package manager | pnpm |

### Why Tauri v2 for Both Platforms

- **One codebase** — the same React + TypeScript app runs on macOS and iOS
- **macOS**: native window, system tray, notifications, auto-update (~30MB vs Electron's 200MB+)
- **iOS**: WKWebView shell, push notifications, runs on iPhone/iPad
- **Rust backend**: shared across platforms for keychain, notifications, native features
- **If native iOS feel is ever needed later**, a SwiftUI client can reuse the same gateway protocol

---

## Gateway Connection

| | |
|---|---|
| **URL** | `wss://patricks-macmini.pangolin-typhon.ts.net/` |
| **Protocol** | OpenClaw gateway v3 over secure WebSocket |
| **Transport** | Tailscale Serve (HTTPS proxy to `127.0.0.1:18789`) |
| **Auth** | Tailscale identity headers (no token needed) |
| **Fallback** | `ws://127.0.0.1:18789` for local development |

> **Note:** The gateway binds to loopback only. The raw Tailscale IP (`100.90.89.126:18789`) is **not reachable** — all remote access goes through Tailscale Serve over HTTPS.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│         The Fireplace (Tauri v2)              │
│         macOS + iOS                           │
│                                               │
│  ┌────────────────┐   ┌──────────────────┐   │
│  │   React UI     │◄──│  WebSocket       │   │
│  │   (webview)    │   │  Client Layer    │───────► wss://patricks-macmini.
│  │                │   │                  │   │     pangolin-typhon.ts.net/
│  │  Responsive:   │   │  - Protocol v3   │   │
│  │  sidebar (mac) │   │  - Challenge/    │   │
│  │  bottom (ios)  │   │    handshake     │   │
│  └────────────────┘   │  - Auto-reconnect│   │
│                       └──────────────────┘   │
│  ┌──────────────────────────────────────┐    │
│  │  Tauri Rust Backend                  │    │
│  │  macOS: system tray, keychain,       │    │
│  │         auto-update, notifications   │    │
│  │  iOS:   keychain, push notifications │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### WebSocket Client Layer
- TypeScript class wrapping the OpenClaw gateway protocol (v3)
- Handles: server `connect.challenge` → client `connect` with signed nonce → server `hello-ok`
- Request/response matching by ID with timeout
- Event subscription system (pub/sub)
- Auto-reconnect with exponential backoff
- Idempotency keys for side-effecting methods
- State version tracking (`presence`, `health` counters)
- Tick/watchdog per `policy.tickIntervalMs`

### State Management (Zustand)
- `connectionStore` — WebSocket state, server info, features, policy
- `chatStore` — active session, messages, streaming state
- `sessionsStore` — session list, previews, usage
- `channelsStore` — channel status, connection health
- `agentStore` — agent list, files, active agent
- `configStore` — gateway config, schema
- `cronStore` — scheduled jobs, execution history
- `logsStore` — log entries, filters
- `approvalsStore` — pending/resolved exec approvals
- `skillsStore` — installed skills, status
- `devicesStore` — paired devices, pairing requests
- `modelsStore` — available models
- `usageStore` — token consumption, costs

Each store syncs with gateway via WebSocket events + RPC calls.

---

## Complete Feature Set

Everything the Control UI does, plus improvements.

### 1. Connection & Auth
- Connect via `wss://` Tailscale Serve URL (configurable)
- Tailscale identity auth (no token management)
- Auto-reconnect with exponential backoff
- Connection status indicator (green/yellow/red)
- Presence display (who else is connected)

### 2. Chat
- Full chat interface with Calcifer
- Session selector (switch between sessions)
- Streaming responses via `chat.send` + event deltas
- Markdown rendering (headings, lists, tables, links)
- Code block rendering with syntax highlighting
- File/image attachments
- Chat history via `chat.history` (up to 1000 messages)
- Abort button (`chat.abort`)
- Inject assistant notes (`chat.inject`)
- Session config inline (model, thinking level)

### 3. Session Management
- List all sessions via `sessions.list` with search/filter
- Preview session content (`sessions.preview`)
- Token usage per session (input/output/total)
- Model info per session
- Patch session config (`sessions.patch` — model, thinking level, etc.)
- Actions: reset, delete, compact
- Usage stats (`sessions.usage`)

### 4. Channel Status Board
- Overview of all connected channels via `channels.status`
- Per-channel: WhatsApp, Discord, Slack, Telegram (extensible)
- Per-account connection state (connected/disconnected/error)
- Last inbound/outbound activity timestamps
- Quick actions: logout, reconnect
- Visual emphasis on WhatsApp + Discord (your active channels)

### 5. Agent Management
- List all agents (`agents.list`)
- Calcifer as primary, with full multi-agent support
- Create/update/delete agents (`agents.create/update/delete`)
- File browser for agent workspaces (`agents.files.list`)
- Read/write agent files (`agents.files.get/set`)
- Inline editor for soul file, tools, identity, memory files (CodeMirror)
- Model assignment per agent
- Agent switching in sidebar

### 6. Config Editor
- Read gateway config (`config.get`)
- Schema-driven form generation (`config.schema`)
- Merge changes (`config.patch`)
- Apply + restart with validation (`config.apply`)
- Raw JSON editor as fallback

### 7. Exec Approvals
- Real-time notifications when agent needs approval (`exec.approval.requested` event)
- Approve/reject from popup or main window
- Approval/deny list management (`exec.approvals.*`)
- History of past approvals

### 8. Cron & Automation
- View scheduled jobs (`cron.*`)
- Create/edit/delete cron jobs
- Execution history and logs
- Enable/disable/trigger jobs manually

### 9. Skills Management
- List installed skills (`skills.*`)
- Install/enable/disable skills
- Skill status and configuration

### 10. Device Management
- List paired devices (`device.*`)
- Approve/reject pairing requests
- Revoke device tokens
- Device token rotation

### 11. Logs & Debug
- Live log tailing (`logs.tail`)
- Filter by level, source, time range
- Health diagnostics (`health.*`)
- Raw gateway method caller for debugging
- Gateway status snapshot

### 12. Model Selection
- List available models (`models.list`)
- Switch default model
- Per-session model override

### 13. Usage & Stats
- Token consumption over time
- Cost tracking
- Per-session and per-channel breakdowns

### 14. System Tray (macOS)
- Persistent menu bar icon (flame)
- Quick status: gateway health, active channels count
- Click to open main window
- Notification badges for exec approvals or errors

### 15. Push Notifications (iOS)
- Exec approval requests
- Channel disconnections
- Agent errors

### 16. Command Palette
- Cmd+K (macOS) for fast navigation
- Search across sessions, agents, commands, settings
- Quick actions (send message, switch session, approve exec)

### 17. Keyboard Shortcuts
- Cmd+N — new session
- Cmd+1-9 — switch views
- Cmd+K — command palette
- Escape — abort/close
- Cmd+Enter — send message
- Full keyboard navigation

---

## Project Structure

```
the-fireplace/
├── src-tauri/              # Rust backend (shared macOS + iOS)
│   ├── src/
│   │   ├── lib.rs          # Shared: commands, keychain, state
│   │   ├── tray.rs         # macOS: system tray
│   │   └── notifications.rs # Native notifications
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── gen/
│       ├── apple/          # Xcode project for iOS
│       └── ...
├── src/                    # React frontend (shared)
│   ├── App.tsx
│   ├── main.tsx
│   ├── gateway/            # WebSocket client + protocol
│   │   ├── client.ts       # GatewayClient class
│   │   ├── types.ts        # Protocol type definitions
│   │   └── protocol.ts     # Frame builders, auth helpers
│   ├── stores/             # Zustand stores
│   │   ├── connection.ts
│   │   ├── chat.ts
│   │   ├── sessions.ts
│   │   ├── channels.ts
│   │   ├── agents.ts
│   │   ├── config.ts
│   │   ├── cron.ts
│   │   ├── logs.ts
│   │   ├── approvals.ts
│   │   ├── skills.ts
│   │   ├── devices.ts
│   │   ├── models.ts
│   │   └── usage.ts
│   ├── views/              # Main views
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
│   │   └── Usage.tsx
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx   # Bottom nav for iOS
│   │   ├── ConnectionStatus.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   └── CodeEditor.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useGateway.ts
│   │   ├── usePlatform.ts  # macOS vs iOS detection
│   │   └── useKeyboard.ts
│   └── lib/                # Utilities
│       ├── utils.ts
│       └── platform.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json         # shadcn/ui config
└── PLAN.md
```

---

## Design Direction

- **Dark mode first** — mission control, not a marketing site
- **Warm palette** — ambers, oranges, deep grays (fireplace theme)
- **Dense but readable** — information-rich dashboards, not big empty cards
- **Keyboard-first** (macOS) — Cmd+K command palette, full shortcuts
- **Touch-first** (iOS) — larger tap targets, swipe gestures, bottom navigation
- **Monospace where it counts** — logs, code, config editing
- **Responsive from day one** — sidebar layout on macOS, tab bar on iOS

---

## Build Phases

### Phase 1 — Skeleton
- Scaffold Tauri v2 project with React + TypeScript + Tailwind v4 + shadcn/ui + pnpm
- Configure for both macOS and iOS targets
- Build `GatewayClient` class implementing full protocol v3 handshake
- Connection status indicator
- App shell with sidebar navigation (macOS) + bottom nav (iOS)
- Dark theme with warm amber palette
- Zustand store scaffolding

### Phase 2 — Chat
- Chat view with session selector
- Streaming message rendering
- Markdown + syntax-highlighted code blocks
- File/image attachments
- Abort functionality
- Inject assistant notes
- Session config inline editing

### Phase 3 — Session & Channel Dashboards
- Sessions list with search/filter + detail view
- Session preview, usage stats, actions (reset/delete/compact)
- Channel status board with per-account health
- Quick actions (logout, reconnect)

### Phase 4 — Agent & Config Management
- Agent list + CRUD
- Agent file browser + inline CodeMirror editor
- Config editor (schema-driven form + raw JSON)
- Config apply with validation
- Model selection

### Phase 5 — Operations
- Exec approval notifications + approve/reject
- Approval/deny list management
- Cron job CRUD + execution history
- Skills install/enable/disable
- Device pairing management

### Phase 6 — Logs, Usage & Debug
- Live log tailing with filters
- Health diagnostics
- Raw method caller (debug tool)
- Usage/cost tracking with breakdowns

### Phase 7 — Polish
- System tray with flame icon + status (macOS)
- Push notifications (iOS)
- Cmd+K command palette
- Full keyboard shortcuts
- Auto-update (macOS)
- Final responsive tweaks for iOS

---

## Gateway RPC Methods (Complete)

| Category | Methods |
|----------|---------|
| **Chat** | `chat.send`, `chat.history`, `chat.abort`, `chat.inject` |
| **Sessions** | `sessions.list`, `sessions.preview`, `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact`, `sessions.usage` |
| **Channels** | `channels.status`, `channels.logout` |
| **Agents** | `agents.list`, `agents.create`, `agents.update`, `agents.delete`, `agents.files.list`, `agents.files.get`, `agents.files.set` |
| **Config** | `config.get`, `config.set`, `config.patch`, `config.apply`, `config.schema` |
| **Exec Approvals** | `exec.approvals.*` |
| **Cron** | `cron.*` |
| **Skills** | `skills.*` |
| **Devices** | `device.*` |
| **Models** | `models.list` |
| **Logs** | `logs.tail` |
| **Health** | `health.*`, `status` |
| **Presence** | `system-presence` |
| **Usage** | `usage.*` |

---

## Resolved Decisions

- **Gateway URL**: `wss://patricks-macmini.pangolin-typhon.ts.net/` via Tailscale Serve (raw IP not reachable)
- **Auth**: Tailscale identity headers — no token management needed
- **iOS**: Tauri v2 mobile (same codebase as macOS, WKWebView)
- **Agents**: Calcifer primary, but full multi-agent UI
- **Channels**: WhatsApp + Discord focus, extensible for others
- **Scope**: Full Control UI replacement — every feature, not an MVP
- **Build order**: Complete all phases before daily use

## Future Ideas (Post-Complete)

- **A2UI / Canvas renderer** — if Canvas features are used
- **Android companion** — Tauri v2 supports Android too
- **Webhook/Gmail dashboard** — automation triggers
- **Voice mode controls** — Voice Wake + Talk Mode
- **Widgets** — macOS widgets for quick status, iOS lock screen widgets
