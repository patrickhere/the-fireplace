# The Fireplace — Mission Control for OpenClaw

## Current Status

**All 12 phases are complete.** The app is in active bug-fixing and polish stage.

- Phases 1-7: Core app skeleton, chat, sessions, channels, agents, config, cron, logs, usage, approvals, skills, devices, models, polish — all complete
- Phase 8: Mac Mini infrastructure (Copilot proxy, Gemini, Claude Code, Codex, 7 demon agents) — complete
- Phases 9-12: Demon UI enhancements, new demon views, replay/templates, integration — all complete
- Recent work: 8+ rounds of code review fixes, stream watchdog, connection watcher, cron poller hardening, verified health checks

---

## What This Is

A native macOS + iOS app that fully replaces OpenClaw's built-in Control UI and TUI. The Fireplace is a personal, polished mission control for your OpenClaw gateway and your agent Calcifer — fast, always accessible, and designed for a single operator.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| App shell | Tauri v2 (macOS + iOS from one codebase) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State | Zustand |
| Routing | React Router |
| Markdown | react-markdown + rehype |
| Code editor | CodeMirror 6 (for config/file editing) |
| Build | Vite |
| Package manager | pnpm |

### Why Tauri v2 for Both Platforms

- **One codebase** — the same React + TypeScript app runs on macOS and iOS
- **macOS**: native window, system tray, notifications, auto-update (~30MB vs Electron's 200MB+)
- **iOS**: WKWebView shell, push notifications, runs on iPhone/iPad
- **Rust backend**: shared across platforms for keychain, notifications, native features

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

| Store | Domain |
|-------|--------|
| `connectionStore` | WebSocket state, server info, features, policy |
| `chatStore` | Active session, messages, streaming state |
| `sessionsStore` | Session list, previews, usage |
| `channelsStore` | Channel status, connection health |
| `agentStore` | Agent list, files, active agent |
| `configStore` | Gateway config, schema, providers |
| `cronStore` | Scheduled jobs, execution history |
| `logsStore` | Log entries, filters |
| `approvalsStore` | Pending/resolved exec approvals |
| `skillsStore` | Installed skills, status |
| `devicesStore` | Paired devices, pairing requests |
| `modelsStore` | Available models |
| `usageStore` | Token consumption, costs |
| `demonChat` | Inter-demon chat room timeline |
| `demonHealth` | Demon status monitoring |
| `demonTasks` | Task queue / kanban pipeline |

Each store syncs with gateway via WebSocket events + RPC calls.

---

## Complete Feature Set

### 1. Connection & Auth
- Connect via `wss://` Tailscale Serve URL (configurable)
- Tailscale identity auth (no token management)
- Auto-reconnect with exponential backoff
- Connection status indicator (green/yellow/red)
- Presence display (who else is connected)

### 2. Chat
- Full chat interface with streaming responses via `chat.send` + event deltas
- Session selector, markdown/code rendering, file/image attachments, bulk upload
- Abort button, inject assistant notes, session config inline (model, thinking level)
- Stream watchdog to prevent infinite streaming state

### 3. Session Management
- List/search/filter sessions, preview content, token usage per session
- Patch session config (model, thinking level), actions: reset/delete/compact

### 4. Channel Status Board
- Overview of all connected channels (WhatsApp, Discord, Slack, Telegram)
- Per-account connection state, last activity timestamps, quick actions

### 5. Agent Management
- Full CRUD for agents with file browser and CodeMirror editor
- Model assignment badges with cost tier coloring (amber=MAX, emerald=free)
- Fallback chain display, demon role summary, active session counts
- Template-based agent creation (10 built-in templates)

### 6. Config Editor
- Schema-driven form + raw JSON editor with hash-based concurrency
- Provider management section (list, add/edit/remove, test connectivity)
- Model routing overview table: Demon → Primary Model → Fallbacks → Cost Tier

### 7. Exec Approvals
- Real-time approval notifications, approve/reject, history
- CLI backend status section (Claude Code / Codex process tracking)

### 8. Cron & Automation
- Job CRUD, run history, enable/disable/trigger
- Demon emoji/name labels, demon task filter, quick-create templates

### 9. Skills, Devices, Logs, Models, Usage
- Skills: install/enable/disable
- Devices: pair/revoke/rotate tokens
- Logs: live tailing with filters
- Models: grouped by provider, cost per 1M tokens, demon assignments, free tier highlights
- Usage: per-demon cards, model distribution breakdown, cost savings highlights

### 10. Demon Chat Room
- Unified timeline of all inter-demon communication (`src/views/DemonChatRoom.tsx`)
- Per-demon emoji identity, color-coded borders, delegation markers
- Live streaming across all demon sessions, per-demon filters
- Inject message capability to any demon

### 11. Demon Health Dashboard
- 7-card responsive grid showing each demon's status (`src/views/DemonHealth.tsx`)
- Status: Idle / Working / Error / Offline with color-coded dots
- Current task, active model, session count, last activity, CLI backend status
- Verified health check button with raw gateway JSON output

### 12. Task Kanban
- 3-column pipeline: Queued / In Progress / Done (`src/views/DemonKanban.tsx`)
- Task cards with demon assignment, delegator, model, CLI backend, timing
- Filter by demon, auto-archive completed tasks

### 13. Session Replay
- Step-through playback of any demon session (`src/components/SessionReplay.tsx`)
- Play/pause/step/speed controls, timeline scrubber
- Delegation highlighting with "Follow delegation" links to child sessions
- Token counter and model annotations

### 14. System Tray, Notifications, Command Palette, Keyboard Shortcuts
- macOS system tray with gateway health and active channel count
- iOS push notifications for approvals, disconnections, errors
- Cmd+K command palette, full keyboard navigation

---

## Project Structure

```
the-fireplace/
├── src-tauri/              # Rust backend (shared macOS + iOS)
│   ├── src/
│   │   ├── lib.rs          # Shared: commands, keychain, state
│   │   ├── tray.rs         # macOS: system tray
│   │   └── notifications.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React frontend (shared)
│   ├── App.tsx
│   ├── main.tsx
│   ├── gateway/            # WebSocket client + protocol
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── protocol.ts
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
│   │   ├── usage.ts
│   │   ├── demonChat.ts
│   │   ├── demonHealth.ts
│   │   └── demonTasks.ts
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
│   │   ├── Usage.tsx
│   │   ├── DemonChatRoom.tsx
│   │   ├── DemonHealth.tsx
│   │   └── DemonKanban.tsx
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── CodeEditor.tsx
│   │   └── SessionReplay.tsx
│   ├── hooks/
│   │   ├── useGateway.ts
│   │   ├── usePlatform.ts
│   │   └── useKeyboard.ts
│   └── lib/
│       ├── utils.ts
│       ├── platform.ts
│       └── demonTemplates.ts
├── scripts/
│   ├── setup-mac-mini.sh
│   ├── launch-demons.sh
│   └── regenerate-icons.sh
├── package.json
├── tsconfig.json
├── vite.config.ts
└── components.json
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

## Build Phases — All Complete

### Phase 1 — Skeleton ✅
### Phase 2 — Chat ✅
### Phase 3 — Session & Channel Dashboards ✅
### Phase 4 — Agent & Config Management ✅
### Phase 5 — Operations ✅
### Phase 6 — Logs, Usage & Debug ✅
### Phase 7 — Polish ✅

### Phase 8 — Infrastructure (Mac Mini) ✅

Deployed the full demon infrastructure on the Mac Mini:
- **Copilot proxy**: Docker/Colima container at `127.0.0.1:4141` with rate limiting
- **Gemini free tier**: API key configured for built-in Google provider
- **Claude Code + Codex CLI**: Installed and authenticated as execution backends
- **7 demon agents created**: Calcifer, Buer, Paimon, Alloces, Dantalion, Andromalius, Malphas
- **Multi-provider model routing**: OpenClaw config with copilot-free, copilot-cheap, copilot-premium, Google, and Anthropic providers
- **Soul files written** with role definitions, delegation rules, and CLI backend preferences
- **Setup script**: `scripts/setup-mac-mini.sh`
- **Launch script**: `scripts/launch-demons.sh`

### Phase 9 — Enhance Existing Views ✅

Enhanced all existing views with demon/model awareness:
- **Agents** (`src/views/Agents.tsx`): Model badges, cost tiers, demon roles, active session counts
- **Usage** (`src/views/Usage.tsx`): Per-demon usage cards, model distribution breakdown, cost savings highlights
- **Config** (`src/views/Config.tsx`): Provider management section, connectivity testing, model routing overview
- **Models** (`src/views/Models.tsx`): Cost per 1M tokens, demon assignments, free tier highlights
- **Cron** (`src/views/Cron.tsx`): Demon labels, task filters, quick-create templates
- **Chat** (`src/views/Chat.tsx`): Bulk upload, batch attachment queuing

### Phase 10 — New Demon Views ✅

Built all new demon-specific views and stores:
- **Demon Chat Room** (`src/views/DemonChatRoom.tsx` + `src/stores/demonChat.ts`): Unified inter-demon timeline with filtering and message injection
- **Demon Health** (`src/views/DemonHealth.tsx` + `src/stores/demonHealth.ts`): 7-card status grid with real-time monitoring and verified health checks
- **Task Kanban** (`src/views/DemonKanban.tsx` + `src/stores/demonTasks.ts`): 3-column pipeline tracking delegation flow
- **Approvals** (`src/views/Approvals.tsx`): Enhanced with CLI backend status and usage tracking

### Phase 11 — Replay & Templates ✅

- **Session Replay** (`src/components/SessionReplay.tsx`): Step-through playback with delegation following and token tracking
- **Demon Templates** (`src/lib/demonTemplates.ts`): 10 built-in templates integrated into Create Agent modal

### Phase 12 — Integration ✅

- Routes wired in `src/App.tsx`: `/demon-chat`, `/demon-health`, `/demon-tasks`
- Sidebar + MobileNav updated with "Demons" nav section
- Multiple rounds of code review and bug fixes applied (8+ fix commits)

---

## Phase 13 — Bug Fixes & Polish (Active)

Comprehensive fix plan based on deep audit of actual functionality. Organized by priority so agents can pick up tasks independently.

### Competitor Analysis Context

Two reference projects were reviewed:
- **[abhi1693/openclaw-mission-control](https://github.com/abhi1693/openclaw-mission-control)** — Next.js + tRPC + Prisma backend, proxies all gateway calls through a server
- **[jontsai's OpenClaw Command Center](https://www.jontsai.com/2026/02/12/building-mission-control-for-my-ai-workforce-introducing-openclaw-command-center)** — Django/Python backend, shells out to `openclaw` CLI

Both competitors proxy gateway calls through a backend server rather than connecting directly from the browser. Key reasons:
1. **CVE-2026-25253** (CVSS 8.8) — cross-site WebSocket hijacking in OpenClaw gateway. Origin headers weren't validated, allowing any website to hijack an authenticated gateway session. Fixed in v2026.1.29 with TOFU policy, but proxying avoids the class of vulnerability entirely.
2. **Auth token security** — keeping device tokens server-side (in DB or keychain) means browser JS never touches secrets. Our Tauri approach is architecturally equivalent since we can store keys in the Rust backend/keychain — but we haven't done that yet (keys are in localStorage).
3. **Multi-gateway / multi-tenant** — a backend proxy can fan out to multiple gateways, aggregate data, and serve multiple users. Not relevant for our single-operator use case.
4. **Caching / rate limiting** — server-side proxy can cache frequently-read data and enforce rate limits. We can achieve this client-side in Zustand stores.

**Our approach (direct WebSocket from Tauri) is architecturally sound** for a native single-operator app — but we must move the Ed25519 private key out of localStorage and into the Rust backend to match the security posture of proxied alternatives.

---

### P0 — Critical Bugs (Must Fix First)

These are blocking basic functionality.

#### P0-1: Chat Renders Raw JSON Instead of Messages
**Files**: `src/stores/chat.ts`, `src/views/Chat.tsx`, `src/components/MarkdownRenderer.tsx`

| Bug | Location | Fix |
|-----|----------|-----|
| `loadHistory` stores raw gateway message objects without normalizing to `{role, content}` | `src/stores/chat.ts` ~line 202-207 | Normalize each history entry: extract `role` and flatten `content` array to text |
| `MessageBubble` only renders blocks where `type === 'text'` — tool_use, tool_result, thinking blocks are invisible | `src/views/Chat.tsx` ~line 193-196 | Add renderers for `tool_use` (collapsible JSON), `tool_result` (output block), `thinking` (italic/dimmed) |
| `extractTextFromEventMessage` returns `''` for tool_use/tool_result/thinking content blocks | `src/stores/chat.ts` ~line 131-151 | Handle all content block types, not just `text` |
| `state=delta` handler uses `text \|\| streamingBuffer` (replaces buffer instead of appending) | `src/stores/chat.ts` ~line 532-534 | Change to `streamingBuffer + text` (append delta to buffer) |
| `MarkdownRenderer` has no guard against non-string `content` prop — crashes on objects | `src/components/MarkdownRenderer.tsx` ~line 213-228 | Add `typeof content === 'string'` check, JSON.stringify objects as fallback |
| Dual event schema not fully handled — legacy `{delta, done, error, seq}` vs alternate `{state, message}` | `src/stores/chat.ts` event handlers | Normalize both schemas to a common shape at the event handler entry point |

#### P0-2: Model Switching Is Completely Broken
**Files**: `src/stores/chat.ts`, `src/stores/models.ts`, `src/views/Chat.tsx`, `src/views/Sessions.tsx`, `src/views/Agents.tsx`, `src/views/Models.tsx`

| Bug | Location | Fix |
|-----|----------|-----|
| `updateSessionConfig` is local-only — never sends `sessions.patch` to gateway | `src/stores/chat.ts` ~line 402-406 | Call `sessions.patch` with `{ model }` after updating local state |
| Default model hardcoded as `claude-sonnet-4-5` | `src/stores/chat.ts` ~line 163-164 | Fetch from `models.list` or use gateway default |
| `chat.send` does not pass model override from sessionConfig | `src/stores/chat.ts` ~line 265-268 | Include `model` param in `chat.send` RPC call |
| Chat model dropdown is 4 hardcoded Claude-only options | `src/views/Chat.tsx` ~line 110-120 | Populate from `modelsStore.models` dynamically |
| `setModel` in models store uses wrong snapshot key (`mainKey` vs `mainSessionKey`) | `src/stores/models.ts` ~line 66-88 | Use correct session key for `sessions.patch` |
| Models view `onSelect()` not awaited; success feedback is fake 1s timer | `src/views/Models.tsx` ~line 84-87 | Await the actual RPC call, show real success/error |
| Sessions view has hardcoded model list missing newer models | `src/views/Sessions.tsx` ~line 139-154 | Use `modelsStore.models` instead of hardcoded array |
| Edit Agent modal has no model field — model is display-only in agent cards | `src/views/Agents.tsx` ~line 336-407 | Add model selector to edit modal, wire to `agents.update` |

#### P0-3: Demon Chat Room Fatal Bugs
**Files**: `src/stores/demonChat.ts`

| Bug | Location | Fix |
|-----|----------|-----|
| **Fatal race**: Events arrive before agents list loads → messages dropped/unattributed | `src/stores/demonChat.ts` ~line 239-256 | Queue events until agents are loaded, then replay queue |
| **Fatal race**: NOOP subscription stored if gateway client is null at mount time | `src/stores/demonChat.ts` ~line 154, 203-208 | Re-subscribe when client becomes available; don't set `isListening: true` until subscription is live |
| `isListening: true` set prematurely — prevents retry if initial subscription failed | `src/stores/demonChat.ts` ~line 418-424 | Only set `isListening: true` after confirmed subscription |
| `_connUnsub` leaks on every disconnect/reconnect cycle | `src/stores/demonChat.ts` ~line 395-408 | Call previous `_connUnsub()` before creating new subscription |
| `injectMessage` calls `chat.send` instead of `chat.inject` | `src/stores/demonChat.ts` ~line 485-489 | Use `chat.inject` RPC method |
| Session lookup uses `startsWith(demonId)` but session keys use `agent:` prefix | `src/stores/demonChat.ts` ~line 468-483 | Match against `agent:${demonId}` prefix |
| Cron pulse filter requires exact "demon pulse" name string — brittle | `src/stores/demonChat.ts` ~line 163-168 | Use a more robust identifier (e.g., cron job ID or tag) |

#### P0-4: Ed25519 Private Key in localStorage (Security)
**Files**: `src/gateway/protocol.ts`, `src-tauri/src/lib.rs`

| Issue | Location | Fix |
|-------|----------|-----|
| Ed25519 private key stored as hex string in `localStorage` — accessible to any XSS | `src/gateway/protocol.ts` ~line 83-135 | Move key generation and signing to Rust backend. Expose only a `sign_payload(payload: string) → signature: string` Tauri command. Private key stored in macOS Keychain / iOS Keychain. WebView never sees the private key. |

---

### P1 — Important UX Gaps

These don't block core functionality but create a poor experience.

#### P1-1: No User Feedback (Toasts / Error Surfacing)
**Scope**: All views

| Issue | Fix |
|-------|-----|
| No toast/notification on any action (create, delete, update, approve, reject) | Add a toast system (e.g., sonner or react-hot-toast). Wire to all mutation actions. |
| Silent `catch()` blocks swallow errors to `console.log` | Surface errors in toasts. At minimum: connection errors, RPC failures, validation errors. |
| No confirmation dialogs for destructive actions (delete session, revoke device, remove agent) | Add confirmation modals before destructive gateway calls |

#### P1-2: Connection Resilience
**Files**: `src/gateway/client.ts`

| Issue | Location | Fix |
|-------|----------|-----|
| Tick watchdog tracks `_lastTickReceivedAt` but never enforces timeout | `src/gateway/client.ts` ~line 134-136, 586-589 | Implement watchdog timer: if no tick received within `2 × policy.tickIntervalMs`, trigger reconnect |
| Event sequence gap detected but no recovery action | `src/gateway/client.ts` ~line 566-573 | On gap detection: log warning + request state refresh from gateway |
| No `visibilitychange` listener for iOS background/foreground | `src/gateway/client.ts` | Add listener: on foreground resume, check connection health, reconnect if stale |
| No client-side rate limiting for RPC calls | `src/gateway/client.ts` ~line 368-439 | Add simple token bucket or debounce for high-frequency methods |

#### P1-3: Loading & Empty States
**Scope**: All views

| Issue | Fix |
|-------|-----|
| No loading spinners while data fetches | Add skeleton/spinner states to all views that fetch on mount |
| No empty states ("No sessions yet", "No agents configured") | Add empty state illustrations/messages |
| No retry buttons on fetch failures | Add "Retry" button when initial data load fails |

---

### P2 — Polish & Hardening

Lower priority but improves overall quality.

#### P2-1: Hardcoded Values
| Issue | Location | Fix |
|-------|----------|-----|
| Hardcoded agent IDs in cron templates | `src/views/Cron.tsx` ~line 52-93 | Load from `agentStore.agents` dynamically |
| Hardcoded cron job UUID | `src/views/Cron.tsx` ~line 18 | Remove hardcoded UUID, use dynamic lookup |
| Hardcoded "demon pulse" cron name | `src/stores/demonChat.ts` | Use tag/metadata instead of name matching |

#### P2-2: Form Validation
| Issue | Fix |
|-------|-----|
| No validation on agent create/edit forms | Add required field checks, name uniqueness, valid model selection |
| No validation on cron schedule expressions | Validate cron syntax before submitting |
| No validation on config editor | Validate against `config.schema` before applying |

#### P2-3: Response Caching
| Issue | Fix |
|-------|-----|
| `models.list` fetched on every Models view mount | Cache in store with TTL (5 min), refresh on explicit action |
| `agents.list` fetched on every Agents view mount | Same pattern — cache with TTL |
| `config.get` fetched fresh every time | Cache with hash-based invalidation (already have hash tracking) |

#### P2-4: Multi-tab Protection
| Issue | Fix |
|-------|-----|
| Multiple tabs/windows could open duplicate WebSocket connections | Use `BroadcastChannel` or lock API to ensure single active connection |

---

### Competitor-Inspired Improvements

Based on code review of [abhi1693/openclaw-mission-control](https://github.com/abhi1693/openclaw-mission-control) (Next.js 16 + FastAPI + Postgres + TanStack React Query). Key patterns worth adopting:

#### CI-1: Defensive Message Normalization (Adopt in P0-1)
**Reference**: `frontend/src/components/BoardOnboardingChat.tsx` — `normalizeMessages()`

Their pattern: every message from the gateway passes through a normalizer that validates `typeof entry === "object"`, checks each field exists and is the right type, skips malformed entries. Returns strict `{role: string, content: string}[]`.

**Apply to**: `src/stores/chat.ts` `loadHistory` — this is the root cause of our "chat shows raw JSON" bug. Normalize gateway history entries into `{role, content}` before storing. Handle cases where `content` is a string, an array of content blocks, or an object.

#### CI-2: Optimistic Cache Updates (Adopt in P1)
**Reference**: Their generic `createOptimisticListDeleteMutation` pattern with TanStack React Query

Our equivalent: When the user deletes a session/agent/cron job, remove it from the Zustand store immediately, then fire the RPC call. If the RPC fails, roll back the local state and show a toast error.

**Apply to**: All destructive actions in `src/stores/sessions.ts`, `src/stores/agents.ts`, `src/stores/cron.ts`. Pattern:
```typescript
// In store action:
const previous = get().items;
set({ items: items.filter(i => i.id !== id) }); // optimistic remove
try {
  await client.request('sessions.delete', { id });
} catch (e) {
  set({ items: previous }); // rollback
  toast.error('Failed to delete session');
}
```

#### CI-3: Gateway Method Catalog Audit (Adopt in P1)
**Reference**: `backend/app/services/openclaw/gateway_rpc.py` — `GATEWAY_METHODS` (70+ methods) and `GATEWAY_EVENTS` (17+ events)

Their backend maintains a complete, documented catalog of every gateway RPC method and event. Our `PLAN.md` only references ~30 methods. We should:
1. Audit their full list against our `src/gateway/client.ts` to find methods we're missing
2. Add any missing event subscriptions (we may be ignoring events that could improve UX)
3. Document the full method list in our gateway types

Known methods from their catalog we likely don't use:
- `sessions.compact` — we have the UI button but may not wire it
- `agents.files.list` / `agents.files.get` / `agents.files.set` — soul file management
- `config.apply` — apply config changes (vs just `config.set`)
- Gateway version/compat checking endpoints

#### CI-4: Kanban FLIP Animation (P2)
**Reference**: `frontend/src/components/organisms/TaskBoard.tsx`

Their kanban implements FLIP (First, Last, Invert, Play) animation:
1. Before React render: measure all card positions (`getBoundingClientRect`)
2. After render: measure new positions
3. Compute deltas, apply `transform` with CSS transition
4. Respects `prefers-reduced-motion`
5. Disables during drag to avoid conflicting with browser drag images

**Apply to**: `src/views/DemonKanban.tsx` — currently has no animation when tasks move between columns. Use `useRef` to store previous positions, `useLayoutEffect` to compute deltas post-render.

#### CI-5: Chat @Mention Autocomplete (P2)
**Reference**: `frontend/src/components/BoardChatComposer.tsx`

Their chat input detects `@` keystrokes, shows a dropdown of agents/users, supports:
- Arrow key navigation through suggestions
- Tab/Enter to select, Escape to dismiss
- Caret position tracking for proper popup placement
- Normalized mention handles inserted into text

**Apply to**: `src/views/DemonChatRoom.tsx` inject message textarea — currently a bare `<textarea>` with no mention support. When user types `@`, show dropdown of demon agents from `agentStore`.

#### CI-6: Approval Confidence Visualization (P2)
**Reference**: `frontend/src/components/BoardApprovalsPanel.tsx`

Their approvals show:
- Confidence score per approval with color-coded badges (emerald ≥90%, amber ≥80%, orange <80%)
- Pie chart summary of approval statuses using Recharts
- Humanized action names (`exec.shell` → "Exec · Shell")

**Apply to**: `src/views/Approvals.tsx` — add confidence badges if gateway provides scores, add summary stats at top of list.

#### CI-7: Operational Metrics Dashboard (Future)
**Reference**: `frontend/src/app/dashboard/page.tsx`

Their dashboard shows:
- KPI cards: active agents, tasks in progress, error rate, median cycle time
- 4 charts: throughput (bar), cycle time (line), error rate (line), WIP distribution (stacked area)
- Date range filter (24h to 1y), board/group filter

**Future view**: `src/views/Dashboard.tsx` — aggregate data from existing stores (demonHealth, demonTasks, usage, sessions) into operational KPIs. Would require no new gateway methods, just computed views over existing data.

#### CI-8: Gateway Version Compatibility Checking (P1)
**Reference**: `backend/app/services/openclaw/gateway_compat.py`

They parse gateway version from multiple response paths with semantic version comparison and clear error messages. We hardcode `protocol: 3` and don't check the gateway version at all.

**Apply to**: `src/gateway/client.ts` — after `hello-ok`, parse server version from response. Store in `connectionStore`. Show warning banner if gateway version is outdated or incompatible.

---

### Implementation Order

```
P0-1 (Chat rendering)     ──┐
  + CI-1 (normalize)       │
P0-2 (Model switching)    ──┼── Can be done in parallel
P0-3 (Demon chat)         ──┤
P0-4 (Key security)       ──┘
         │
         ▼
P1-1 (Toast system)       ──┐
  + CI-2 (optimistic)      │
P1-2 (Connection)         ──┼── Can be done in parallel after P0
  + CI-8 (version compat)  │
P1-3 (Loading states)     ──┤
CI-3 (Method catalog)     ──┘
         │
         ▼
P2-* (Polish)             ──┐
CI-4 (Kanban FLIP)        ──┤
CI-5 (@mention chat)      ──┼── After P1, lower priority
CI-6 (Approval viz)       ──┤
CI-7 (Metrics dashboard)  ──┘  (CI-7 is future/optional)
```

All P0 items are independent and can be assigned to separate agents or worked in parallel. CI-1 should be done alongside P0-1 (same files). CI-2 and CI-8 fold into their respective P1 items. P2 and remaining CI items are lower priority.

---

## Demon Agent Architecture

### The Seven Demons

| Demon | ID | Primary Model | Cost Tier | Role |
|-------|----|---------------|-----------|------|
| Calcifer | `calcifer` | `anthropic/claude-sonnet-4-5` | MAX sub | Primary orchestrator, critical decisions |
| Buer | `buer` | `copilot-free/gpt-4.1` | FREE (0x) | Architect: code audit, optimization |
| Paimon | `paimon` | `google/gemini-2.5-flash` | FREE (Gemini) | Knowledge: research, documentation |
| Alloces | `alloces` | `copilot-free/gpt-4.1` | FREE (0x) | Strategy: resource allocation, planning |
| Dantalion | `dantalion` | `copilot-free/gpt-5-mini` | FREE (0x) | Intent: NLU, context inference |
| Andromalius | `andromalius` | `copilot-free/gpt-4.1` | FREE (0x) | Security: threat monitoring, access control |
| Malphas | `malphas` | `copilot-free/gpt-4.1` | FREE (0x) | Builder: code generation, scaffolding |

> **Copilot Proxy Billing Reality**: GitHub bills premium requests server-side by MODEL, not endpoint. Only 0x models (GPT-4.1, GPT-5 mini, GPT-4o) are truly unlimited. Claude models cost 1-3x premium requests each. Strategy: all demons default to FREE 0x models. Heavy coding is offloaded to CLI backends (Claude Code / Codex) covered by existing subscriptions. Claude MAX API is fallback-only for critical tasks.

### CLI Backend Routing

Any demon can use either CLI backend dynamically based on task type:

| Task Type | Preferred Backend | Fallback |
|-----------|------------------|----------|
| Multi-file refactoring | Claude Code | Codex |
| Code generation / scaffolding | Codex | Claude Code |
| Code review / audit | Claude Code | Codex |
| Bug debugging | Claude Code | Codex |
| Rapid prototyping | Codex | Claude Code |
| Test writing | Either (round-robin) | — |

Configured per-demon in soul files — advisory, not enforced.

### Demon Cron Jobs

| Job | Demon | Schedule | Description |
|-----|-------|----------|-------------|
| System Audit | Buer | Every 6h | Audit codebase, report optimization opportunities |
| Context Cleanup | Alloces | Every 4h | Check session sizes, compact bloated sessions |
| Security Scan | Andromalius | Daily 3am | Review access logs, check for anomalies |
| Knowledge Sync | Paimon | Daily 9am | Aggregate overnight research, update docs |

---

## Cost Analysis

| Service | Monthly Cost | What It Provides |
|---------|-------------|------------------|
| Claude MAX | $100 | Claude Code CLI backend + Opus/Sonnet API fallback for critical tasks |
| ChatGPT Plus | $20 | Codex CLI backend + backup |
| GitHub Copilot Pro | $10 | GPT-4.1 + GPT-5 mini + GPT-4o (0x unlimited) + 300 premium req/mo budget |
| Gemini API | $0 | Free tier — Paimon primary, heartbeats |
| **Total** | **$130/mo** | Down from ~$1,750+/mo on direct API |

### How It Actually Works

| Layer | Model | Cost | Used For |
|-------|-------|------|----------|
| **Demon thinking** | GPT-4.1 / GPT-5 mini via Copilot proxy | $0 (0x unlimited) | 5 demons (Buer, Alloces, Dantalion, Andromalius, Malphas) |
| **Orchestration** | Claude Sonnet 4.5 (MAX sub) | Covered by $100/mo | Calcifer only |
| **Research & docs** | Gemini 2.5 Flash (free tier) | $0 | Paimon, heartbeats, bulk processing |
| **Heavy coding** | Claude Code CLI (MAX sub) | Covered by $100/mo | Multi-file refactors, deep analysis |
| **Rapid generation** | Codex CLI (Plus sub) | Covered by $20/mo | Scaffolding, prototyping |
| **Critical decisions** | Claude Opus API (MAX sub) | Covered by $100/mo | Calcifer/Andromalius escalation only |
| **Premium proxy models** | Claude Sonnet/Haiku via proxy | 300 req/mo budget | Emergency fallback only |

**Key insight**: Demons do their *thinking* on free models, but *execute* heavy work through CLI backends (Claude Code / Codex) which are covered by existing subscriptions.

---

## Verification Checklist

### Infrastructure
- [x] Copilot proxy responding at `127.0.0.1:4141` on Mac Mini
- [x] `openclaw models list` shows all configured providers and models
- [x] Claude Code and Codex CLI installed and authenticated
- [x] All 7 demon agents registered (`openclaw agents list --json` confirms)

### Fireplace UI — Core Views
- [x] Agents view shows model assignment badge per demon
- [x] Usage view shows per-demon token breakdown and model distribution
- [x] Config view lists providers with management UI
- [x] Models view groups by provider with cost tier and demon assignments
- [x] Cron view shows demon labels and filters
- [x] Chat view supports bulk upload

### Fireplace UI — Demon Views
- [x] Demon Chat Room shows unified inter-demon timeline with filters
- [x] Demon Health Dashboard shows all 7 demons with real-time status
- [x] Demon Health includes verified health check with raw JSON output
- [x] Task Kanban shows queued/in-progress/done columns
- [x] Session Replay plays back messages with controls
- [x] Demon Templates appear in Create Agent modal
- [x] Approvals view shows CLI backend status
- [x] All new routes wired and accessible from sidebar/nav

### Ongoing Validation
- [ ] Monitor Copilot proxy for GitHub abuse warnings over time
- [ ] Verify Gemini requests stay within free tier limits
- [ ] Track demon task completion rates and latency

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GitHub Copilot account suspension | Low | Rate limit to 2s between requests, keep <10k req/day, maintain MAX fallback |
| Gemini free tier quota exhaustion | Medium | Use Flash-Lite for volume, fall back to Copilot proxy |
| Copilot proxy API compatibility issues | Medium | Test each model before production use, keep fallback chain |
| OpenClaw config format changes | Low | Use `config.schema` to validate, test with `openclaw doctor --fix` |

---

## Gateway RPC Methods (Reference)

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

- **Gateway URL**: `wss://patricks-macmini.pangolin-typhon.ts.net/` via Tailscale Serve
- **Auth**: Tailscale identity headers — no token management needed
- **iOS**: Tauri v2 mobile (same codebase as macOS, WKWebView)
- **Agents**: Calcifer primary, full multi-agent UI
- **Channels**: WhatsApp + Discord focus, extensible
- **Scope**: Full Control UI replacement — every feature, not an MVP
- **Demons**: OpenClaw agents with per-agent model routing via config
- **Cost optimization**: Copilot proxy ($10/mo) + Gemini free tier for 5 of 7 demons
- **CLI backends**: Claude Code + Codex available to all demons, task-based dynamic routing
- **Demon Chat Room**: Dedicated view for observing inter-demon communication

## Future Ideas

- **A2UI / Canvas renderer** — if Canvas features are used
- **Android companion** — Tauri v2 supports Android too
- **Webhook/Gmail dashboard** — automation triggers
- **Voice mode controls** — Voice Wake + Talk Mode
- **Widgets** — macOS widgets for quick status, iOS lock screen widgets
- **Demon performance dashboard** — track task completion rates, latency per demon
- **CLI backend analytics** — track Claude Code vs Codex success rates, latency, cost per task type
