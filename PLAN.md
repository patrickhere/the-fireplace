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

## Build Phases (Original — Complete)

### Phase 1 — Skeleton ✅
### Phase 2 — Chat ✅
### Phase 3 — Session & Channel Dashboards ✅
### Phase 4 — Agent & Config Management ✅
### Phase 5 — Operations ✅
### Phase 6 — Logs, Usage & Debug ✅
### Phase 7 — Polish ✅

---

## Phase 8: Mission Control — Demon Agent Architecture & Cost-Optimized Model Routing

### Context

With all original phases complete, The Fireplace now has:
- Full gateway protocol v3 WebSocket client with device auth
- 14 Zustand stores covering agents, sessions, chat, cron, config, usage, etc.
- 13 views with CRUD, file editing, cron management, config editing
- Agent management (create/update/delete + file browser + CodeMirror editor)
- Config editing (raw JSON with hash-based concurrency)
- Cron scheduling (create/edit/trigger jobs per agent)
- Usage tracking (token counts, per-session breakdown)

**Goal**: Extend this existing system to support a demon-themed multi-agent architecture with intelligent model routing that minimizes API costs through GitHub Copilot proxy + free Gemini tier, while enhancing the UI to provide mission-control-grade visibility into demon activity, model routing, and cost savings.

**Key decisions**:
- Demons are OpenClaw agents (managed via `agents.*` gateway methods)
- Model routing lives in OpenClaw config (server-side, `models.providers` + per-agent `model` assignment)
- Enhance existing views (Agents, Usage, Config) rather than creating new views
- Use existing Cron system for demon task scheduling
- Document processing via OpenClaw sessions (attachments in chat)
- Create all 7 demons at once (Calcifer + 6 specialists)
- Proxy management: full management UI in Config view + health monitoring in Usage view
- Codex + Claude Code as CLI execution backends — any demon can spawn either per task
- Demon Chat Room — dedicated view to watch inter-demon communication in real time

---

### 8.1 Infrastructure — Proxy Setup on Mac Mini

**What**: Deploy GitHub Copilot API proxy and configure Gemini free tier on the Mac Mini (where OpenClaw gateway runs).

#### Install Docker on Mac Mini

```bash
# SSH to Mac Mini via Tailscale
ssh patricks-macmini.pangolin-typhon.ts.net

# Install Docker Desktop for macOS (or Colima for headless)
brew install --cask docker
# OR for headless: brew install colima && colima start
```

#### Deploy Copilot API Proxy

**File to create on Mac Mini**: `~/fireplace-infra/docker-compose.yml`

```yaml
version: "3.8"
services:
  copilot-proxy:
    image: ghcr.io/ericc-ch/copilot-api:latest
    container_name: copilot-proxy
    ports:
      - "127.0.0.1:4141:4141"
    volumes:
      - copilot-data:/root/.local/share/copilot-api
    restart: unless-stopped
    command: ["start", "--rate-limit", "2", "--port", "4141"]

volumes:
  copilot-data:
```

Steps:
1. `docker compose up -d`
2. Check logs for auth URL: `docker compose logs copilot-proxy`
3. Open auth URL in browser, authenticate with GitHub (must have Copilot Individual subscription)
4. Verify: `curl http://127.0.0.1:4141/v1/models`

#### Configure Gemini Free Tier

No proxy needed — OpenClaw has a built-in Gemini provider. Just need the API key.

1. Go to https://aistudio.google.com/ → "Get API Key" → Create key
2. Set on Mac Mini: `export GEMINI_API_KEY="AIza..."`
3. Add to shell profile for persistence

#### Subscribe to GitHub Copilot Individual

- GitHub Settings → Copilot → Subscribe to Individual ($10/month)
- Provides access to: Claude 3.5 Sonnet, GPT-4o, GPT-4o-mini, o1-mini via proxy

#### Install Claude Code on Mac Mini

Claude Code is part of Claude MAX subscription (already have it).

```bash
# Install via npm (already available on Mac Mini)
npm install -g @anthropic-ai/claude-code

# Authenticate (one-time)
claude login

# Verify
claude --version
```

**Integration**: OpenClaw can spawn Claude Code as an execution backend via `exec` tools. Demons invoke it for coding tasks requiring deep codebase understanding, multi-file refactors, and complex debugging.

#### Install OpenAI Codex CLI on Mac Mini

Codex comes with ChatGPT Plus subscription (already have it).

```bash
# Install via npm
npm install -g @openai/codex

# Authenticate (one-time — uses ChatGPT Plus account)
codex login

# Verify
codex --version
```

**Integration**: Same as Claude Code — spawned as execution backend. Good for code generation, rapid prototyping, and tasks where GPT-4o excels.

#### CLI Backend Routing Strategy

Any demon can use either CLI backend dynamically based on task type:

| Task Type | Preferred Backend | Fallback |
|-----------|------------------|----------|
| Multi-file refactoring | Claude Code | Codex |
| Code generation / scaffolding | Codex | Claude Code |
| Code review / audit | Claude Code | Codex |
| Bug debugging | Claude Code | Codex |
| Rapid prototyping | Codex | Claude Code |
| Documentation generation | Codex | Claude Code |
| Security analysis | Claude Code | Codex |
| Test writing | Either (round-robin) | — |

This is configured per-demon in the soul file — each demon's system prompt includes instructions on when to prefer which backend. The routing is advisory, not enforced — demons can override based on context.

Example soul file addition:
```markdown
## Execution Backends
When you need to execute coding tasks, you have two CLI backends available:
- **Claude Code** (`claude`): Prefer for deep analysis, multi-file refactors, security review
- **Codex** (`codex`): Prefer for rapid generation, scaffolding, prototyping
Choose based on the task. You may use either for any task — these are preferences, not rules.
```

---

### 8.2 OpenClaw Configuration — Multi-Provider Model Routing

**What**: Configure OpenClaw's `~/.openclaw/openclaw.json` with multiple providers and per-demon model assignments.

#### Add Custom Providers

Edit `~/.openclaw/openclaw.json` on Mac Mini:

```json5
{
  models: {
    mode: "merge",  // Keep built-in providers (anthropic, openai, google)
    providers: {
      "copilot": {
        baseUrl: "http://127.0.0.1:4141",
        apiKey: "dummy",
        api: "anthropic-messages",
        models: [
          {
            id: "claude-3.5-sonnet",
            name: "Copilot Claude 3.5 Sonnet",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192
          }
        ]
      },
      "copilot-openai": {
        baseUrl: "http://127.0.0.1:4141/v1",
        apiKey: "dummy",
        api: "openai-completions",
        models: [
          {
            id: "gpt-4o",
            name: "Copilot GPT-4o",
            reasoning: false,
            cost: { input: 0, output: 0 },
            contextWindow: 128000,
            maxTokens: 16384
          },
          {
            id: "gpt-4o-mini",
            name: "Copilot GPT-4o Mini",
            reasoning: false,
            cost: { input: 0, output: 0 },
            contextWindow: 128000,
            maxTokens: 16384
          },
          {
            id: "o1-mini",
            name: "Copilot o1-mini",
            reasoning: true,
            cost: { input: 0, output: 0 },
            contextWindow: 128000,
            maxTokens: 65536
          }
        ]
      }
    }
  }
}
```

**Note**: Gemini uses the built-in `google` provider — just needs `GEMINI_API_KEY` env var set.

#### Configure Model Aliases

```json5
{
  agents: {
    defaults: {
      models: {
        // Copilot proxy models (free)
        "copilot/claude-3.5-sonnet": { alias: "copilot-sonnet" },
        "copilot-openai/gpt-4o": { alias: "copilot-gpt4o" },
        "copilot-openai/gpt-4o-mini": { alias: "copilot-mini" },
        "copilot-openai/o1-mini": { alias: "copilot-o1" },
        // Gemini free tier
        "google/gemini-2.5-flash": { alias: "flash" },
        "google/gemini-2.5-flash-lite": { alias: "flash-lite" },
        // Claude MAX (existing subscription)
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "anthropic/claude-sonnet-4-5": { alias: "sonnet" }
      },
      model: {
        primary: "copilot/claude-3.5-sonnet",
        fallbacks: [
          "copilot-openai/gpt-4o",
          "google/gemini-2.5-flash",
          "anthropic/claude-sonnet-4-5"
        ]
      },
      heartbeat: {
        model: "google/gemini-2.5-flash-lite"
      },
      subagents: {
        model: "copilot-openai/gpt-4o-mini"
      }
    }
  }
}
```

#### Verify Configuration

```bash
openclaw models list                    # Should show all configured models
openclaw models status --probe          # Test connectivity to all endpoints
```

---

### 8.3 Create Demon Agents in OpenClaw

**What**: Create all 7 demon agents via OpenClaw CLI or via Fireplace's existing Agents view.

#### Demon Definitions

| Demon | ID | Model | Role |
|-------|----|-------|------|
| **Calcifer** 🔥 | `calcifer` | `anthropic/claude-opus-4-6` (MAX) | Primary orchestrator, critical decisions |
| **Buer** 📐 | `buer` | `copilot/claude-3.5-sonnet` (free) | Architect: code audit, optimization |
| **Paimon** 📚 | `paimon` | `google/gemini-2.5-flash` (free) | Knowledge: research, documentation |
| **Alloces** ♟️ | `alloces` | `copilot-openai/gpt-4o` (free) | Strategy: resource allocation, planning |
| **Dantalion** 🧠 | `dantalion` | `copilot-openai/gpt-4o-mini` (free) | Intent: NLU, context inference |
| **Andromalius** 🛡️ | `andromalius` | `anthropic/claude-sonnet-4-5` (MAX) | Security: threat monitoring, access control |
| **Malphas** 🏗️ | `malphas` | `copilot/claude-3.5-sonnet` (free) | Builder: code generation, scaffolding |

#### Create via OpenClaw CLI

```bash
openclaw agents create --id calcifer --name "Calcifer" --emoji "🔥" --workspace ~/.openclaw/agents/calcifer
openclaw agents create --id buer --name "Buer" --emoji "📐" --workspace ~/.openclaw/agents/buer
openclaw agents create --id paimon --name "Paimon" --emoji "📚" --workspace ~/.openclaw/agents/paimon
openclaw agents create --id alloces --name "Alloces" --emoji "♟️" --workspace ~/.openclaw/agents/alloces
openclaw agents create --id dantalion --name "Dantalion" --emoji "🧠" --workspace ~/.openclaw/agents/dantalion
openclaw agents create --id andromalius --name "Andromalius" --emoji "🛡️" --workspace ~/.openclaw/agents/andromalius
openclaw agents create --id malphas --name "Malphas" --emoji "🏗️" --workspace ~/.openclaw/agents/malphas
```

#### Per-Demon Model Assignment (in OpenClaw config)

```json5
{
  agents: {
    list: [
      {
        id: "calcifer",
        model: { primary: "anthropic/claude-opus-4-6", fallbacks: ["anthropic/claude-sonnet-4-5", "copilot/claude-3.5-sonnet"] }
      },
      {
        id: "buer",
        model: { primary: "copilot/claude-3.5-sonnet", fallbacks: ["copilot-openai/gpt-4o", "google/gemini-2.5-flash"] }
      },
      {
        id: "paimon",
        model: { primary: "google/gemini-2.5-flash", fallbacks: ["google/gemini-2.5-flash-lite", "copilot-openai/gpt-4o-mini"] }
      },
      {
        id: "alloces",
        model: { primary: "copilot-openai/gpt-4o", fallbacks: ["copilot/claude-3.5-sonnet", "google/gemini-2.5-flash"] }
      },
      {
        id: "dantalion",
        model: { primary: "copilot-openai/gpt-4o-mini", fallbacks: ["google/gemini-2.5-flash-lite"] }
      },
      {
        id: "andromalius",
        model: { primary: "anthropic/claude-sonnet-4-5", fallbacks: ["copilot/claude-3.5-sonnet"] }
      },
      {
        id: "malphas",
        model: { primary: "copilot/claude-3.5-sonnet", fallbacks: ["copilot-openai/gpt-4o"] }
      }
    ]
  }
}
```

#### Soul Files (System Prompts)

Each demon gets `~/.openclaw/agents/<id>/agent/soul.md` — editable via Fireplace Agents → File Browser → CodeMirror.

Example (Calcifer):
```markdown
# Calcifer — Fire Demon of Orchestration

You are Calcifer, the primary orchestration demon for Mission Control.

## Role
- Receive natural language instructions from the operator
- Analyze task complexity and delegate to specialized demons
- Make critical decisions that require frontier model intelligence
- Coordinate multi-demon workflows

## Delegation Rules
- Simple code audits → Buer
- Research tasks → Paimon
- Resource planning → Alloces
- Intent parsing → Dantalion
- Security concerns → Andromalius
- Code generation → Malphas
- Complex/critical tasks → handle yourself
```

---

### 8.4 Fireplace UI Enhancements

**What**: Enhance existing views for demon visibility, model routing, and proxy health.

#### A. Agents View (`src/views/Agents.tsx`)

**Current** (599 lines): 3-column layout, CRUD modals, file browser, CodeMirror editor.

**Add**:
- Model assignment badge on each agent card (color-coded: amber=MAX, emerald=free)
- Fallback chain display on expand/hover
- Demon role summary when selected (from soul file)
- Active sessions count per demon

**Files**: `src/stores/agents.ts` (extend Agent interface with `model`), `src/views/Agents.tsx`

#### B. Usage View (`src/views/Usage.tsx`)

**Current** (329 lines): Summary cards + per-session sortable table.

**Add**:
- Model distribution breakdown (% requests per provider, grouped: Copilot free / Gemini free / MAX paid)
- Cost savings highlight ("X% of requests at $0 cost")
- Per-demon usage cards (filter sessions by agentId, show tokens + model)
- Proxy health status dots per provider endpoint

**Files**: `src/stores/usage.ts` (add `loadDemonUsage()`), `src/views/Usage.tsx`

#### C. Config View (`src/views/Config.tsx`)

**Current** (338 lines): Raw JSON editor with schema sidebar.

**Add**:
- "Model Providers" section above raw editor (list providers: name, URL, API type, model count)
- Add/edit/remove providers via form (generates JSON patch)
- Test connectivity button per endpoint
- Model routing overview table: Demon → Primary Model → Fallbacks → Provider → Cost Tier

**Files**: `src/stores/config.ts` (add `parsedProviders`, `testEndpoint()`), `src/views/Config.tsx`

#### D. Models View (`src/views/Models.tsx`)

**Current** (191 lines): Model list grouped by provider, set default.

**Add**:
- Cost per 1M tokens display
- Which demons are assigned to each model
- Free tier highlight (emerald badge)

**Files**: `src/views/Models.tsx`

#### E. Cron View (`src/views/Cron.tsx`)

**Current** (696 lines): Job CRUD, run history, enable/disable.

**Add**:
- Demon emoji/name next to job name when `agentId` is set
- "Demon Tasks" filter toggle
- Quick-create templates for common demon tasks

**Files**: `src/views/Cron.tsx`

#### F. Chat View (`src/views/Chat.tsx`)

**Current** (720 lines): Session selector, streaming, attachments, abort.

**Add**:
- Bulk upload button (multiple files at once)
- Queue attachments and send in batches
- Processing progress indicator

**Files**: `src/views/Chat.tsx`, `src/stores/chat.ts`

---

### 8.5 Demon Task Scheduling via Cron

Use the existing Cron system — no new infrastructure.

| Job | Demon | Schedule | Description |
|-----|-------|----------|-------------|
| System Audit | Buer | Every 6h | Audit codebase, report optimization opportunities |
| Context Cleanup | Alloces | Every 4h | Check session sizes, compact bloated sessions |
| Security Scan | Andromalius | Daily 3am | Review access logs, check for anomalies |
| Knowledge Sync | Paimon | Daily 9am | Aggregate overnight research, update docs |

Each uses `payload.kind: 'agentTurn'` with the demon's `agentId`.

---

### 8.6 Document Processing via Chat

Uses existing chat attachment system — no new infrastructure for basic flow.

1. Open chat session with target demon (e.g., Paimon)
2. Attach documents via existing file attachment UI
3. Send instruction
4. Demon processes via its assigned model

Enhanced with bulk upload mode (Step 8.4F above).

---

### 8.7 Demon Chat Room — Inter-Demon Communication View

**What**: A new view where you can watch demons talk to each other as they work. Like a mission control chat room showing all inter-demon delegation, coordination, and status updates in real time.

#### Concept

When Calcifer delegates a task to Buer, or Andromalius flags a security concern to Calcifer, those inter-agent messages flow through OpenClaw sessions. The Demon Chat Room aggregates these into a single unified timeline so you can observe the swarm working.

#### Design

- **New view**: `src/views/DemonChatRoom.tsx` — accessible from sidebar/nav
- **Unified timeline**: All demon sessions merged into one chronological feed
- **Demon identity**: Each message shows the demon's emoji + name + model badge
- **Color-coded**: Each demon gets a subtle left-border color for visual distinction
- **Delegation markers**: Special rendering for delegation events (Calcifer → Buer: "Audit this module")
- **Status updates**: Show when demons start/complete tasks, switch models, hit errors
- **Live streaming**: Subscribe to chat events across all demon sessions simultaneously
- **Filters**: Toggle individual demons on/off, filter by message type (delegation / work / status)
- **Read-only by default**: Observe mode. Optional "Inject" button to send a message to any demon from here.

#### Data Flow

1. Each demon has its own OpenClaw sessions (already exists)
2. Demon Chat Room subscribes to `chat` events for ALL demon agent sessions
3. Events are merged into a single timeline, decorated with demon identity
4. Gateway already sends `agentId` on session events — use this to identify which demon is speaking

#### Store

**New file**: `src/stores/demonChat.ts`

```typescript
interface DemonChatMessage {
  id: string;
  demonId: string;        // agentId
  demonName: string;
  demonEmoji: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  timestamp: number;
  isDelegation: boolean;  // true if this is a delegation from one demon to another
  targetDemonId?: string; // who the delegation is to
}

interface DemonChatStore {
  messages: DemonChatMessage[];
  activeDemonFilters: Set<string>;  // which demons to show
  isStreaming: boolean;

  // Actions
  startListening: () => void;       // subscribe to all demon session events
  stopListening: () => void;
  toggleDemonFilter: (demonId: string) => void;
  injectMessage: (demonId: string, message: string) => void;
}
```

#### View Layout

```
┌─────────────────────────────────────────────┐
│  Demon Chat Room                    [Filters]│
│  7 demons active · 12 messages/min           │
├─────────────────────────────────────────────┤
│                                              │
│  🔥 Calcifer → 📐 Buer                      │
│  "Audit the auth module for security gaps"   │
│  copilot-sonnet · 2s ago                     │
│                                              │
│  📐 Buer                                     │
│  "Starting audit of src/gateway/protocol.ts  │
│   and src/gateway/client.ts..."              │
│  copilot-sonnet · 1s ago                     │
│                                              │
│  🛡️ Andromalius                              │
│  "Routine security scan complete. No         │
│   anomalies detected in last 24h."          │
│  claude-sonnet-4-5 · just now                │
│                                              │
│  📚 Paimon                                   │
│  "Research summary: Found 3 relevant         │
│   papers on context window optimization..."  │
│  gemini-2.5-flash · just now                 │
│                                              │
├─────────────────────────────────────────────┤
│  [Inject message to: ▾ Calcifer] [________] │
└─────────────────────────────────────────────┘
```

#### Files

- **New**: `src/stores/demonChat.ts` — Demon chat room store
- **New**: `src/views/DemonChatRoom.tsx` — Demon chat room view
- **Modify**: `src/App.tsx` — Add route `/demon-chat`
- **Modify**: `src/components/Sidebar.tsx` — Add nav item
- **Modify**: `src/components/MobileNav.tsx` — Add nav item (or under More)

---

### 8.8 CLI Execution Backend Integration

**What**: Configure OpenClaw to allow demons to spawn Claude Code and Codex CLI processes for coding tasks.

#### How It Works

OpenClaw agents already have `exec` tool capabilities (that's what the Approvals system manages). When a demon needs to run a coding task:

1. Demon decides which CLI backend to use (per soul file guidance)
2. Demon issues exec request: `claude "refactor auth module"` or `codex "generate test suite"`
3. OpenClaw's exec approval system routes the request
4. Admin can auto-approve known patterns or manually approve via Fireplace Approvals view
5. CLI backend runs in the demon's workspace directory
6. Output is captured back into the demon's session

#### Approval Configuration

Add to exec approvals allowlist (via Fireplace Approvals view):

```json5
{
  agents: {
    // Allow all demons to use Claude Code and Codex
    "*": {
      allowlist: [
        { pattern: "claude *", security: "low" },
        { pattern: "codex *", security: "low" }
      ]
    }
  }
}
```

Or per-demon if you want tighter control:
```json5
{
  agents: {
    "malphas": {
      allowlist: [
        { pattern: "claude *", security: "low" },
        { pattern: "codex *", security: "low" }
      ]
    },
    "buer": {
      allowlist: [
        { pattern: "claude *", security: "low" }
      ]
    }
  }
}
```

#### Fireplace UI for Backend Management

Enhance Approvals view to show CLI backend usage:
- Show which demons are currently running Claude Code / Codex processes
- Quick-approve patterns for CLI backends
- Usage stats: how many CLI invocations per demon per day

**Files to modify**:
- `src/views/Approvals.tsx` — Add CLI backend status section

---

### Implementation Order

| Step | What | Where |
|------|------|-------|
| 1 | Infrastructure: Docker, Copilot proxy, Gemini key | Mac Mini (no code) |
| 1b | Install Claude Code + Codex CLI on Mac Mini | Mac Mini (no code) |
| 2 | OpenClaw config: providers, aliases, fallbacks | Mac Mini config file |
| 3 | Create 7 demon agents + soul files (incl. CLI backend guidance) | Mac Mini CLI / Fireplace UI |
| 4 | Enhance Agents store & view | `src/stores/agents.ts`, `src/views/Agents.tsx` |
| 5 | Enhance Usage store & view | `src/stores/usage.ts`, `src/views/Usage.tsx` |
| 6 | Enhance Config store & view | `src/stores/config.ts`, `src/views/Config.tsx` |
| 7 | Enhance Models view | `src/views/Models.tsx` |
| 8 | Enhance Cron view | `src/views/Cron.tsx` |
| 9 | Enhance Chat view | `src/views/Chat.tsx`, `src/stores/chat.ts` |
| 10 | Build Demon Chat Room | `src/stores/demonChat.ts`, `src/views/DemonChatRoom.tsx` |
| 11 | Configure CLI backend approvals | Via Fireplace Approvals view |
| 12 | Enhance Approvals view for CLI backends | `src/views/Approvals.tsx` |
| 13 | Create demon cron jobs | Via Fireplace Cron view |

### Files Modified & Created (Fireplace code)

| File | Status | Changes |
|------|--------|---------|
| `src/stores/agents.ts` | Modify | Extend Agent interface with `model` field |
| `src/stores/usage.ts` | Modify | Add `loadDemonUsage()` grouping by agentId |
| `src/stores/config.ts` | Modify | Add `parsedProviders` derived state, `testEndpoint()` |
| `src/stores/chat.ts` | Modify | Batch attachment handling |
| `src/stores/demonChat.ts` | **New** | Demon Chat Room store (inter-demon timeline) |
| `src/views/Agents.tsx` | Modify | Model badge, cost tier, demon role display |
| `src/views/Usage.tsx` | Modify | Model distribution, per-demon cards, proxy health |
| `src/views/Config.tsx` | Modify | Provider management section, routing overview |
| `src/views/Models.tsx` | Modify | Cost info, demon assignments, free tier highlight |
| `src/views/Cron.tsx` | Modify | Demon labels, filter, quick-create templates |
| `src/views/Chat.tsx` | Modify | Bulk upload mode |
| `src/views/DemonChatRoom.tsx` | **New** | Inter-demon chat room view |
| `src/views/Approvals.tsx` | Modify | CLI backend status section |
| `src/App.tsx` | Modify | Add `/demon-chat` route |
| `src/components/Sidebar.tsx` | Modify | Add Demon Chat Room nav item |
| `src/components/MobileNav.tsx` | Modify | Add nav item (or under More) |

---

### Cost Analysis

| Service | Monthly Cost | Purpose |
|---------|-------------|---------|
| Claude MAX | $100 | Calcifer + Andromalius (API) + Claude Code CLI backend |
| ChatGPT Plus | $20 | Codex CLI backend + backup API |
| GitHub Copilot Individual | $10 | Buer, Alloces, Malphas, Dantalion (free API routing) |
| Gemini API | $0 | Free tier — Paimon (research), heartbeats |
| **Total** | **$130/mo** | Down from ~$1,750+/mo on direct API |

**5 of 7 demons run at $0 marginal API cost** (Copilot proxy + Gemini free tier).
**All 7 demons** can spawn Claude Code or Codex for coding tasks — covered by existing MAX + Plus subs.

---

### Verification Plan

#### Infrastructure
- [ ] `curl http://127.0.0.1:4141/v1/models` returns Copilot models on Mac Mini
- [ ] `openclaw models list` shows all configured providers and models
- [ ] `openclaw models status --probe` shows all endpoints healthy

#### Demon Agents
- [ ] All 7 agents appear in Fireplace Agents view
- [ ] Each agent's soul file is editable via File Browser
- [ ] Sending a message to each demon routes through the correct model
- [ ] Fallback chain works: disable Copilot proxy → demons fall back to next model

#### CLI Backends
- [ ] `claude --version` works on Mac Mini
- [ ] `codex --version` works on Mac Mini
- [ ] Demon can spawn Claude Code via exec and output is captured
- [ ] Demon can spawn Codex via exec and output is captured
- [ ] Approvals allowlist permits CLI backend invocations

#### Fireplace UI
- [ ] Agents view shows model assignment badge per demon
- [ ] Usage view shows per-demon token breakdown
- [ ] Usage view shows model distribution by provider
- [ ] Config view lists all providers with health status
- [ ] Config view allows adding/editing provider endpoints
- [ ] Models view groups by provider and shows cost tier
- [ ] Cron view shows demon labels on agent-targeted jobs
- [ ] Demon Chat Room shows unified inter-demon timeline
- [ ] Demon Chat Room filters work per-demon
- [ ] Demon Chat Room inject message works
- [ ] Approvals view shows CLI backend status

#### Cost Validation
- [ ] Send test messages through each demon, verify they route through intended provider
- [ ] Check Copilot proxy dashboard: requests flowing through
- [ ] Verify Gemini requests stay within free tier limits
- [ ] Monitor for any GitHub Copilot abuse warnings over first week

---

### Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GitHub Copilot account suspension | Low | Rate limit to 2s between requests, keep <10k req/day, maintain MAX fallback |
| Gemini free tier quota exhaustion | Medium | Use Flash-Lite (1000 RPD) for volume, fall back to Copilot proxy |
| Copilot proxy API compatibility issues | Medium | Test each model before production use, keep fallback chain |
| OpenClaw config format changes | Low | Use `config.schema` to validate, test with `openclaw doctor --fix` |

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
- **Demons**: OpenClaw agents with per-agent model routing via config
- **Cost optimization**: Copilot proxy ($10/mo) + Gemini free tier for 5 of 7 demons
- **CLI backends**: Claude Code + Codex available to all demons, task-based dynamic routing (not static)
- **Demon Chat Room**: Dedicated view for observing inter-demon communication in real time

## Future Ideas (Post-Complete)

- **A2UI / Canvas renderer** — if Canvas features are used
- **Android companion** — Tauri v2 supports Android too
- **Webhook/Gmail dashboard** — automation triggers
- **Voice mode controls** — Voice Wake + Talk Mode
- **Widgets** — macOS widgets for quick status, iOS lock screen widgets
- **Demon performance dashboard** — track task completion rates, latency per demon
- **CLI backend analytics** — track Claude Code vs Codex success rates, latency, cost per task type
