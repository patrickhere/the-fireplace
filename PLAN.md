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

## Phases 8–12: Mission Control — Demon Agent Architecture & Cost-Optimized Model Routing

> **Parallelization note**: These phases are structured so multiple agents can work on them concurrently. Each sub-phase lists its dependencies explicitly. Phases 8A/8B/8C are infrastructure (Mac Mini). Phases 9–12 are Fireplace code and can be parallelized across agents — see dependency graph below.

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

### Phase 8: Infrastructure & Configuration (Mac Mini — no Fireplace code)

> **Can be done manually or scripted. No dependencies on other phases.**

#### 8A. Proxy Setup on Mac Mini

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

#### 8B. OpenClaw Configuration — Multi-Provider Model Routing

**What**: Configure OpenClaw's `~/.openclaw/openclaw.json` with multiple providers and per-demon model assignments.

#### Add Custom Providers

Edit `~/.openclaw/openclaw.json` on Mac Mini:

```json5
{
  models: {
    mode: "merge",  // Keep built-in providers (anthropic, openai, google)
    providers: {
      // FREE tier (0x multiplier, truly unlimited on Copilot Pro)
      "copilot-free": {
        baseUrl: "http://127.0.0.1:4141/v1",
        apiKey: "dummy",
        api: "openai-completions",
        models: [
          { id: "gpt-4.1", name: "Copilot GPT-4.1 (Free)", cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 16384 },
          { id: "gpt-5-mini", name: "Copilot GPT-5 Mini (Free)", cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 16384 },
          { id: "gpt-4o", name: "Copilot GPT-4o (Free)", cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 16384 }
        ]
      },
      // CHEAP tier (0.33x, ~900 calls/mo on 300 budget)
      "copilot-cheap": {
        baseUrl: "http://127.0.0.1:4141",
        apiKey: "dummy",
        api: "anthropic-messages",
        models: [
          { id: "claude-haiku-4.5", name: "Copilot Claude Haiku 4.5 (0.33x)", cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 16384 }
        ]
      },
      // PREMIUM tier (1x-3x, use sparingly)
      "copilot-premium": {
        baseUrl: "http://127.0.0.1:4141",
        apiKey: "dummy",
        api: "anthropic-messages",
        models: [
          { id: "claude-sonnet-4.5", name: "Copilot Claude Sonnet 4.5 (1x)", cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 16384 },
          { id: "claude-opus-4.6", name: "Copilot Claude Opus 4.6 (3x)", cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 16384 }
        ]
      }
    }
  }
}
```

**Note**: Gemini uses the built-in `google` provider — just needs `GEMINI_API_KEY` env var set. Copilot proxy billing is determined server-side by model — only 0x models (GPT-4.1, GPT-5 mini, GPT-4o) are truly free.

#### Configure Model Aliases

```json5
{
  agents: {
    defaults: {
      models: {
        // Copilot proxy — FREE (0x, unlimited)
        "copilot-free/gpt-4.1": { alias: "gpt41" },
        "copilot-free/gpt-5-mini": { alias: "gpt5mini" },
        "copilot-free/gpt-4o": { alias: "gpt4o" },
        // Copilot proxy — CHEAP (0.33x, ~900/mo)
        "copilot-cheap/claude-haiku-4.5": { alias: "haiku" },
        // Gemini free tier
        "google/gemini-2.5-flash": { alias: "flash" },
        "google/gemini-2.5-flash-lite": { alias: "flash-lite" },
        // Claude MAX (existing subscription)
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "anthropic/claude-sonnet-4-5": { alias: "sonnet" }
      },
      model: {
        primary: "copilot-free/gpt-4.1",
        fallbacks: [
          "copilot-free/gpt-5-mini",
          "google/gemini-2.5-flash",
          "anthropic/claude-sonnet-4-5"
        ]
      },
      heartbeat: {
        model: "google/gemini-2.5-flash-lite"
      },
      subagents: {
        model: "copilot-free/gpt-5-mini"
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

#### 8C. Create Demon Agents in OpenClaw

**What**: Create all 7 demon agents via OpenClaw CLI or via Fireplace's existing Agents view.

#### Demon Definitions

| Demon | ID | Primary Model | Cost Tier | Role |
|-------|----|---------------|-----------|------|
| **Calcifer** 🔥 | `calcifer` | `anthropic/claude-sonnet-4-5` | MAX sub | Primary orchestrator, critical decisions |
| **Buer** 📐 | `buer` | `copilot-free/gpt-4.1` | FREE (0x) | Architect: code audit, optimization |
| **Paimon** 📚 | `paimon` | `google/gemini-2.5-flash` | FREE (Gemini) | Knowledge: research, documentation |
| **Alloces** ♟️ | `alloces` | `copilot-free/gpt-4.1` | FREE (0x) | Strategy: resource allocation, planning |
| **Dantalion** 🧠 | `dantalion` | `copilot-free/gpt-5-mini` | FREE (0x) | Intent: NLU, context inference |
| **Andromalius** 🛡️ | `andromalius` | `copilot-free/gpt-4.1` | FREE (0x) | Security: threat monitoring, access control |
| **Malphas** 🏗️ | `malphas` | `copilot-free/gpt-4.1` | FREE (0x) | Builder: code generation, scaffolding |

> **IMPORTANT — Copilot Proxy Billing Reality**: The proxy does NOT make all models free. GitHub bills premium requests server-side based on the MODEL requested, not the endpoint. Only models with 0x multiplier (GPT-4.1, GPT-5 mini, GPT-4o) are truly unlimited. Claude models cost 1-3x premium requests each (Opus = 3x = ~100 calls/mo on Pro's 300 budget). **Strategy**: All demons default to FREE 0x models. Heavy coding work is offloaded to CLI backends (Claude Code / Codex) which are covered by existing subscriptions. Claude MAX API is fallback-only for Calcifer/Andromalius critical tasks.

#### Create via OpenClaw CLI

OpenClaw CLI uses a two-step process: `agents add` to create, then `agents set-identity` to name:

```bash
# Step 1: Add each agent with workspace
openclaw agents add calcifer --workspace ~/.openclaw/agents/calcifer
openclaw agents add buer --workspace ~/.openclaw/agents/buer
openclaw agents add paimon --workspace ~/.openclaw/agents/paimon
openclaw agents add alloces --workspace ~/.openclaw/agents/alloces
openclaw agents add dantalion --workspace ~/.openclaw/agents/dantalion
openclaw agents add andromalius --workspace ~/.openclaw/agents/andromalius
openclaw agents add malphas --workspace ~/.openclaw/agents/malphas

# Step 2: Set identity for each
openclaw agents set-identity --agent calcifer --name "Calcifer" --emoji "🔥"
openclaw agents set-identity --agent buer --name "Buer" --emoji "📐"
openclaw agents set-identity --agent paimon --name "Paimon" --emoji "📚"
openclaw agents set-identity --agent alloces --name "Alloces" --emoji "♟️"
openclaw agents set-identity --agent dantalion --name "Dantalion" --emoji "🧠"
openclaw agents set-identity --agent andromalius --name "Andromalius" --emoji "🛡️"
openclaw agents set-identity --agent malphas --name "Malphas" --emoji "🏗️"
```

Alternative: Create via Fireplace Agents view (has full CRUD UI).

#### Per-Demon Model Assignment (in OpenClaw config)

```json5
// Copilot proxy billing tiers:
//   FREE (0x, unlimited): GPT-4.1, GPT-5 mini, GPT-4o
//   CHEAP (0.33x, ~900/mo): Claude Haiku 4.5, Gemini 3 Flash
//   STANDARD (1x, 300/mo): Claude Sonnet 4.5, GPT-5, GPT-5.1
//   EXPENSIVE (3x, ~100/mo): Claude Opus 4.5/4.6
{
  agents: {
    list: [
      {
        id: "calcifer",
        model: { primary: "anthropic/claude-sonnet-4-5", fallbacks: ["anthropic/claude-opus-4-6", "copilot-free/gpt-4.1"] }
      },
      {
        id: "buer",
        model: { primary: "copilot-free/gpt-4.1", fallbacks: ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"] }
      },
      {
        id: "paimon",
        model: { primary: "google/gemini-2.5-flash", fallbacks: ["copilot-free/gpt-4.1", "copilot-free/gpt-5-mini"] }
      },
      {
        id: "alloces",
        model: { primary: "copilot-free/gpt-4.1", fallbacks: ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"] }
      },
      {
        id: "dantalion",
        model: { primary: "copilot-free/gpt-5-mini", fallbacks: ["copilot-free/gpt-4.1", "google/gemini-2.5-flash"] }
      },
      {
        id: "andromalius",
        model: { primary: "copilot-free/gpt-4.1", fallbacks: ["anthropic/claude-sonnet-4-5", "copilot-free/gpt-5-mini"] }
      },
      {
        id: "malphas",
        model: { primary: "copilot-free/gpt-4.1", fallbacks: ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"] }
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

### Phase 9: Enhance Existing Views (Fireplace code)

> **Dependencies**: None — works with existing gateway data. Can start before Phase 8 is done.
> **Parallelizable**: Each view (A–F) can be worked on by a separate agent simultaneously.

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

#### G. Demon Task Scheduling via Cron (enhancement to existing Cron view)

Use the existing Cron system — no new infrastructure.

| Job | Demon | Schedule | Description |
|-----|-------|----------|-------------|
| System Audit | Buer | Every 6h | Audit codebase, report optimization opportunities |
| Context Cleanup | Alloces | Every 4h | Check session sizes, compact bloated sessions |
| Security Scan | Andromalius | Daily 3am | Review access logs, check for anomalies |
| Knowledge Sync | Paimon | Daily 9am | Aggregate overnight research, update docs |

Each uses `payload.kind: 'agentTurn'` with the demon's `agentId`.

---

#### H. Document Processing via Chat (enhancement to existing Chat view)

Uses existing chat attachment system — no new infrastructure for basic flow.

1. Open chat session with target demon (e.g., Paimon)
2. Attach documents via existing file attachment UI
3. Send instruction
4. Demon processes via its assigned model

Enhanced with bulk upload mode (Step 8.4F above).

---

### Phase 10: New Demon Views (Fireplace code)

> **Dependencies**: Requires `src/stores/agents.ts` model field from Phase 9A. Otherwise independent.
> **Parallelizable**: Each view (Chat Room, Health, Kanban) can be built by a separate agent simultaneously.

#### 10A. Demon Chat Room — Inter-Demon Communication View

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

#### 10B. CLI Execution Backend Integration (Approvals view enhancement)

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
  defaults: {
    security: "high",
    autoAllowSkills: false,
    ask: "always",
    askFallback: "deny"
  },
  agents: {
    // NEVER use broad "claude *" or "codex *" wildcards — they allow arbitrary execution.
    // Use narrow read-only patterns only:
    "malphas": {
      security: "high",
      allowlist: [
        { pattern: "claude --print *" },
        { pattern: "claude -p *" },
        { pattern: "codex --print *" },
        { pattern: "codex -q *" },
        { pattern: "pnpm format *" },
        { pattern: "pnpm lint *" }
      ]
    },
    "buer": {
      security: "high",
      allowlist: [
        { pattern: "claude --print *" },
        { pattern: "npm audit *" },
        { pattern: "npx tsc --noEmit *" }
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

#### 10C. Demon Health Dashboard

**What**: A real-time grid showing each demon's operational status — like a process monitor for the swarm.

#### Design

- **New view**: `src/views/DemonHealth.tsx` — accessible from sidebar/nav
- **7-card grid**: One card per demon, responsive (2-col mobile, 4-col desktop)
- Each card shows:
  - Demon emoji + name
  - **Status**: Idle / Working / Error / Offline (with color-coded dot: zinc/amber/red/zinc-800)
  - **Current task**: What the demon is working on right now (from active session's last user message)
  - **Model in use**: Which model is currently active (primary or fallback)
  - **Uptime**: Time since last restart/error
  - **Session count**: Active sessions for this demon
  - **Last activity**: Relative timestamp ("2m ago")
  - **CLI backend**: If running Claude Code or Codex, show which + elapsed time

#### Data Sources

- Demon status derived from session activity (active chat events = working, no events in 5m = idle)
- Current task from latest `chat.send` message in the demon's active session
- Model from session config or latest response metadata
- CLI backend status from exec approval events (running process = active)

#### Store

**New file**: `src/stores/demonHealth.ts`

```typescript
interface DemonStatus {
  demonId: string;
  state: 'idle' | 'working' | 'error' | 'offline';
  currentTask: string | null;
  activeModel: string;
  activeSessions: number;
  lastActivity: number;        // timestamp
  uptime: number;              // ms since last error/restart
  cliBackend: {
    active: boolean;
    tool: 'claude-code' | 'codex' | null;
    startedAt: number | null;
  };
}

interface DemonHealthStore {
  demons: DemonStatus[];
  isPolling: boolean;

  // Actions
  startMonitoring: () => void;   // subscribe to session + exec events
  stopMonitoring: () => void;
  refreshAll: () => void;
}
```

#### View Layout

```
┌──────────────────────────────────────────────────────┐
│  Demon Health                          [Refresh All] │
│  5 active · 1 idle · 1 working                       │
├────────────────────────┬─────────────────────────────┤
│  🔥 Calcifer           │  📐 Buer                    │
│  ● Working             │  ● Working                  │
│  "Coordinate auth      │  "Auditing gateway/         │
│   refactor across 3    │   client.ts for memory      │
│   demons"              │   leaks"                    │
│  opus · 2 sessions     │  copilot-sonnet · 1 session │
│  12m ago               │  Claude Code running (3m)   │
├────────────────────────┼─────────────────────────────┤
│  📚 Paimon             │  ♟️ Alloces                  │
│  ● Idle                │  ● Working                  │
│  —                     │  "Planning Q2 resource      │
│                        │   allocation"               │
│  flash · 0 sessions    │  copilot-gpt4o · 1 session  │
│  45m ago               │  5m ago                     │
├────────────────────────┼─────────────────────────────┤
│  🧠 Dantalion          │  🛡️ Andromalius             │
│  ● Idle                │  ● Working                  │
│  —                     │  "Nightly security scan     │
│                        │   in progress"              │
│  copilot-mini · 0      │  sonnet-4-5 · 1 session     │
│  2h ago                │  1m ago                     │
├────────────────────────┼─────────────────────────────┤
│  🏗️ Malphas             │                             │
│  ● Working             │                             │
│  "Generating test      │                             │
│   suite for auth mod"  │                             │
│  copilot-sonnet · 1    │                             │
│  Codex running (1m)    │                             │
└────────────────────────┴─────────────────────────────┘
```

#### Files

- **New**: `src/stores/demonHealth.ts` — Health monitoring store
- **New**: `src/views/DemonHealth.tsx` — Health dashboard view
- **Modify**: `src/App.tsx` — Add route `/demon-health`
- **Modify**: `src/components/Sidebar.tsx` — Add nav item
- **Modify**: `src/components/MobileNav.tsx` — Add nav item (or under More)

---

#### 10D. Task Queue / Kanban — Demon Work Pipeline

**What**: A visual pipeline showing tasks flowing through demons — from delegation to completion.

#### Concept

When Calcifer delegates work, it creates a task. That task moves through stages: **Queued** → **In Progress** → **Done** (or **Failed**). The Kanban view shows this as columns so you can see the flow of work across all demons at a glance.

#### Design

- **New view**: `src/views/DemonKanban.tsx` — accessible from sidebar/nav
- **3 columns**: Queued | In Progress | Done (with Failed as a sub-state of Done)
- **Task cards** show:
  - Task description (from delegation message)
  - Assigned demon (emoji + name)
  - Delegated by (which demon or operator)
  - Model being used
  - Time in current stage
  - CLI backend if active (Claude Code / Codex)
- **Drag-and-drop**: Manually re-prioritize queued tasks (optional, nice-to-have)
- **Filters**: By demon, by delegator, by age
- **Auto-archive**: Done tasks fade after 1h, move to history after 24h

#### Data Model

Tasks are derived from inter-demon delegation patterns in chat sessions:
1. When a demon sends a message to another demon's session → "Queued" task
2. When the target demon starts responding → "In Progress"
3. When the target demon's response completes → "Done"
4. If error event fires → "Failed"

**New file**: `src/stores/demonTasks.ts`

```typescript
interface DemonTask {
  id: string;
  description: string;
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  assignedTo: string;           // demonId
  delegatedBy: string;          // demonId or 'operator'
  sessionKey: string;
  model: string;
  cliBackend: 'claude-code' | 'codex' | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

interface DemonTaskStore {
  tasks: DemonTask[];
  archivedTasks: DemonTask[];
  filterDemon: string | null;

  // Actions
  startTracking: () => void;    // subscribe to delegation events
  stopTracking: () => void;
  setFilter: (demonId: string | null) => void;
  archiveCompleted: () => void;
}
```

#### View Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Task Pipeline                    [Filter: All Demons ▾]     │
│  3 queued · 2 in progress · 8 done today                     │
├──────────────────┬───────────────────┬───────────────────────┤
│  QUEUED (3)      │  IN PROGRESS (2)  │  DONE (8)             │
├──────────────────┼───────────────────┼───────────────────────┤
│ ┌──────────────┐ │ ┌───────────────┐ │ ┌───────────────────┐ │
│ │ Review PR #42 │ │ │ Auth refactor │ │ │ ✓ Security scan   │ │
│ │ → 📐 Buer    │ │ │ → 🏗️ Malphas  │ │ │   🛡️ Andromalius  │ │
│ │ by 🔥Calcifer│ │ │ by 🔥Calcifer │ │ │   12m · sonnet-4-5│ │
│ │ 2m waiting   │ │ │ Codex (5m)    │ │ └───────────────────┘ │
│ └──────────────┘ │ │ copilot-sonnet│ │ ┌───────────────────┐ │
│ ┌──────────────┐ │ └───────────────┘ │ │ ✓ Context cleanup  │ │
│ │ Update docs  │ │ ┌───────────────┐ │ │   ♟️ Alloces       │ │
│ │ → 📚 Paimon  │ │ │ Audit gateway │ │ │   8m · copilot-4o │ │
│ │ by 🔥Calcifer│ │ │ → 📐 Buer     │ │ └───────────────────┘ │
│ │ 30s waiting  │ │ │ Claude Code   │ │ ┌───────────────────┐ │
│ └──────────────┘ │ │ (3m)          │ │ │ ✗ Parse intent     │ │
│ ┌──────────────┐ │ │ copilot-sonnet│ │ │   🧠 Dantalion     │ │
│ │ Plan sprint  │ │ └───────────────┘ │ │   Failed: timeout  │ │
│ │ → ♟️ Alloces  │ │                   │ └───────────────────┘ │
│ │ by operator  │ │                   │        ...            │
│ │ just now     │ │                   │                       │
│ └──────────────┘ │                   │                       │
└──────────────────┴───────────────────┴───────────────────────┘
```

#### Files

- **New**: `src/stores/demonTasks.ts` — Task tracking store
- **New**: `src/views/DemonKanban.tsx` — Kanban view
- **Modify**: `src/App.tsx` — Add route `/demon-tasks`
- **Modify**: `src/components/Sidebar.tsx` — Add nav item
- **Modify**: `src/components/MobileNav.tsx` — Add nav item (or under More)

---

### Phase 11: Session Replay & Templates (Fireplace code)

> **Dependencies**: Replay depends on Demon Chat Room (10A) and Sessions view. Templates depend on Agents view (9A).
> **Parallelizable**: Replay and Templates can be built by separate agents simultaneously.

#### 11A. Replay Mode — Session Playback

**What**: Rewind and replay any demon's session to see exactly how a decision was made, how a delegation chain unfolded, or where something went wrong.

#### Concept

Every demon's work is captured in OpenClaw sessions. Replay mode lets you step through a session message-by-message, like watching a recording. Useful for:
- Debugging bad delegation chains ("Why did Calcifer route this to Paimon instead of Buer?")
- Learning from successful workflows ("How did Malphas approach this scaffolding task?")
- Auditing security decisions ("Show me Andromalius's full analysis")

#### Design

- **Accessed from**: Demon Chat Room (replay button on any message), Sessions view (replay button), Demon Health (replay last session)
- **Playback controls**: Play / Pause / Step Forward / Step Back / Speed (1x, 2x, 5x, 10x)
- **Timeline scrubber**: Visual bar showing message positions in the session
- **Delegation highlighting**: When a message triggers a delegation, show a visual link to the target demon's session with a "Follow delegation" button
- **Side-by-side mode**: Follow a delegation chain by showing parent and child sessions simultaneously
- **Token counter**: Running total of tokens consumed during replay
- **Model annotations**: Show when the demon switched models (fallback triggered)

#### View

Not a separate route — renders as a modal/overlay from other views.

**New component**: `src/components/SessionReplay.tsx`

```typescript
interface SessionReplayProps {
  sessionKey: string;
  startFromMessageId?: string;  // jump to specific message
}

interface ReplayState {
  sessionKey: string;
  messages: Message[];
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 5 | 10;
  linkedSession: string | null;  // delegation target session
}
```

#### View Layout

```
┌──────────────────────────────────────────────────────┐
│  Session Replay: calcifer-auth-refactor    [✕ Close] │
│  ◄◄  ▶  ►►  │ Step 4 of 23  │ Speed: 2x │ ━━●━━━━  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [operator] 10:32am                                  │
│  "Refactor the auth module to use Ed25519"           │
│                                                      │
│  [🔥 Calcifer] 10:32am · opus                       │
│  "Analyzing complexity... This requires:             │
│   1. Code audit (→ Buer)                             │
│   2. Security review (→ Andromalius)                 │
│   3. Implementation (→ Malphas)                      │
│   Delegating step 1 first."                          │
│                                                      │
│  → DELEGATION to 📐 Buer                             │
│    [Follow →] opens buer-audit-auth session          │
│                                                      │
│  ▸ [🔥 Calcifer] 10:35am · opus          (next msg) │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Tokens so far: 12,450 in · 3,200 out               │
│  Model: anthropic/claude-opus-4-6                    │
└──────────────────────────────────────────────────────┘
```

#### Files

- **New**: `src/components/SessionReplay.tsx` — Replay overlay component
- **Modify**: `src/views/DemonChatRoom.tsx` — Add replay button per message
- **Modify**: `src/views/Sessions.tsx` — Add replay button per session
- **Modify**: `src/views/DemonHealth.tsx` — Add "replay last session" per demon

---

#### 11B. Demon Templates — Quick-Spawn New Specialists

**What**: Pre-built soul file templates so you can quickly create new demon agents with well-defined roles, without writing the system prompt from scratch.

#### Concept

The current 7 demons cover the core roles, but you may want to spin up ad-hoc specialists (e.g., a demon focused on a specific project, a temporary research assistant, a data pipeline demon). Templates provide a starting point.

#### Built-in Templates

| Template | Description | Default Model | Tier |
|----------|-------------|---------------|------|
| **Orchestrator** | Delegates tasks, coordinates workflows | `anthropic/claude-sonnet-4-5` | MAX |
| **Code Architect** | Reviews, audits, optimizes code | `copilot-free/gpt-4.1` | Free |
| **Researcher** | Deep research, documentation, knowledge synthesis | `google/gemini-2.5-flash` | Free |
| **Strategist** | Planning, resource allocation, decision analysis | `copilot-free/gpt-4.1` | Free |
| **Builder** | Code generation, scaffolding, implementation | `copilot-free/gpt-4.1` | Free |
| **Security Analyst** | Threat monitoring, access control, vulnerability scanning | `copilot-free/gpt-4.1` | Free |
| **Data Engineer** | Data pipelines, ETL, database management | `copilot-free/gpt-4.1` | Free |
| **DevOps** | Infrastructure, CI/CD, deployment automation | `copilot-free/gpt-4.1` | Free |
| **QA / Tester** | Test writing, test execution, bug reproduction | `copilot-free/gpt-5-mini` | Free |
| **Blank** | Empty soul file, define from scratch | (default) | Free |

Each template includes:
- Pre-written soul file with role description, communication style, delegation rules
- Suggested model assignment with fallback chain
- Suggested CLI backend preferences
- Recommended cron job templates for recurring tasks

#### Integration into Agents View

Enhance the existing Create Agent modal:

1. **Step 1: Choose template** — grid of template cards (or "Blank")
2. **Step 2: Customize** — pre-filled name, emoji, model based on template; user can override
3. **Step 3: Create** — creates agent + writes soul file + sets model in config

#### Template Storage

Templates stored as static data in the frontend (no backend needed):

**New file**: `src/lib/demonTemplates.ts`

```typescript
interface DemonTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  soulFile: string;           // markdown content for soul.md
  suggestedModel: {
    primary: string;
    fallbacks: string[];
  };
  cliPreferences: {
    preferred: 'claude-code' | 'codex' | 'either';
    guidance: string;
  };
  suggestedCronJobs: Array<{
    name: string;
    schedule: string;
    description: string;
  }>;
}
```

#### Files

- **New**: `src/lib/demonTemplates.ts` — Template definitions
- **Modify**: `src/views/Agents.tsx` — Enhance CreateAgentModal with template picker

---

### Phase 12: Integration & Wiring

> **Dependencies**: All previous phases. This is the final assembly step.

**What**: Wire up all new views into the app routing, navigation, and ensure everything works together.

- Add routes to `src/App.tsx`: `/demon-chat`, `/demon-health`, `/demon-tasks`
- Add nav items to `src/components/Sidebar.tsx` and `src/components/MobileNav.tsx`
- Group new demon views under a "Demons" nav section (collapsible)
- End-to-end testing: verify all views load, stores connect, events flow

**Files**:
- `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/MobileNav.tsx`

---

### Dependency Graph (for parallel agent assignment)

```
Phase 8 (Infrastructure — Mac Mini)
  8A: Proxy Setup ──────────┐
  8B: OpenClaw Config ──────┤── no Fireplace code deps
  8C: Create Demon Agents ──┘

Phase 9 (Enhance Existing Views — all parallelizable)
  9A: Agents View ─────┐
  9B: Usage View ──────┤
  9C: Config View ─────┤── each can be a separate agent
  9D: Models View ─────┤
  9E: Cron View ───────┤
  9F: Chat View ───────┘

Phase 10 (New Demon Views — parallelizable, soft dep on 9A)
  10A: Demon Chat Room ────┐
  10B: CLI Backend (Approvals)──┤── each can be a separate agent
  10C: Demon Health ───────┤
  10D: Task Kanban ────────┘

Phase 11 (Replay & Templates — depends on 10A + 9A)
  11A: Session Replay ─────── depends on 10A (Chat Room), Sessions view
  11B: Demon Templates ────── depends on 9A (Agents view)

Phase 12 (Integration — depends on all above)
  Wire routes, nav, end-to-end testing
```

**Recommended agent assignment** (6 agents working in parallel):

| Agent | Assigned Work |
|-------|---------------|
| Agent 1 | 9A (Agents) + 11B (Templates) — sequential, same files |
| Agent 2 | 9B (Usage) + 9C (Config) — sequential, related stores |
| Agent 3 | 9D (Models) + 9E (Cron) + 9F (Chat) — sequential, smaller tasks |
| Agent 4 | 10A (Demon Chat Room) + 11A (Replay) — sequential, Replay depends on Chat Room |
| Agent 5 | 10C (Demon Health) + 10D (Task Kanban) — sequential, similar patterns |
| Agent 6 | 10B (CLI Approvals) + 12 (Integration/Wiring) — sequential, Approvals first then final wiring |

---

### Implementation Order

| Step | What | Where |
|------|------|-------|
| 1 | Infrastructure: Docker, Copilot proxy, Gemini key, Claude Code, Codex | Mac Mini (no code) |
| 2 | OpenClaw config: providers, aliases, fallbacks | Mac Mini config file |
| 3 | Create 7 demon agents + soul files (incl. CLI backend guidance) | Mac Mini CLI / Fireplace UI |
| 4 | Enhance Agents store & view + demon templates | `src/stores/agents.ts`, `src/views/Agents.tsx`, `src/lib/demonTemplates.ts` |
| 5 | Enhance Usage store & view | `src/stores/usage.ts`, `src/views/Usage.tsx` |
| 6 | Enhance Config store & view | `src/stores/config.ts`, `src/views/Config.tsx` |
| 7 | Enhance Models view | `src/views/Models.tsx` |
| 8 | Enhance Cron view | `src/views/Cron.tsx` |
| 9 | Enhance Chat view | `src/views/Chat.tsx`, `src/stores/chat.ts` |
| 10 | Build Demon Chat Room | `src/stores/demonChat.ts`, `src/views/DemonChatRoom.tsx` |
| 11 | Build Demon Health Dashboard | `src/stores/demonHealth.ts`, `src/views/DemonHealth.tsx` |
| 12 | Build Task Queue / Kanban | `src/stores/demonTasks.ts`, `src/views/DemonKanban.tsx` |
| 13 | Build Session Replay | `src/components/SessionReplay.tsx` |
| 14 | Enhance Approvals view for CLI backends | `src/views/Approvals.tsx` |
| 15 | Wire up routes + nav for new views | `src/App.tsx`, Sidebar, MobileNav |
| 16 | Configure CLI backend approvals + create demon cron jobs | Via Fireplace UI |

### Files Modified & Created (Fireplace code)

| File | Status | Changes |
|------|--------|---------|
| `src/stores/agents.ts` | Modify | Extend Agent interface with `model` field |
| `src/stores/usage.ts` | Modify | Add `loadDemonUsage()` grouping by agentId |
| `src/stores/config.ts` | Modify | Add `parsedProviders` derived state, `testEndpoint()` |
| `src/stores/chat.ts` | Modify | Batch attachment handling |
| `src/stores/demonChat.ts` | **New** | Demon Chat Room store (inter-demon timeline) |
| `src/stores/demonHealth.ts` | **New** | Demon health monitoring store |
| `src/stores/demonTasks.ts` | **New** | Task queue / kanban store |
| `src/lib/demonTemplates.ts` | **New** | Demon agent templates |
| `src/views/Agents.tsx` | Modify | Model badge, cost tier, demon role, template picker |
| `src/views/Usage.tsx` | Modify | Model distribution, per-demon cards, proxy health |
| `src/views/Config.tsx` | Modify | Provider management section, routing overview |
| `src/views/Models.tsx` | Modify | Cost info, demon assignments, free tier highlight |
| `src/views/Cron.tsx` | Modify | Demon labels, filter, quick-create templates |
| `src/views/Chat.tsx` | Modify | Bulk upload mode |
| `src/views/DemonChatRoom.tsx` | **New** | Inter-demon chat room view |
| `src/views/DemonHealth.tsx` | **New** | Demon health dashboard view |
| `src/views/DemonKanban.tsx` | **New** | Task queue kanban view |
| `src/views/Approvals.tsx` | Modify | CLI backend status section |
| `src/views/Sessions.tsx` | Modify | Add replay button per session |
| `src/components/SessionReplay.tsx` | **New** | Session replay overlay component |
| `src/App.tsx` | Modify | Add routes: `/demon-chat`, `/demon-health`, `/demon-tasks` |
| `src/components/Sidebar.tsx` | Modify | Add nav items for new views |
| `src/components/MobileNav.tsx` | Modify | Add nav items (or under More) |

---

### Cost Analysis

| Service | Monthly Cost | What It Provides |
|---------|-------------|------------------|
| Claude MAX | $100 | Claude Code CLI backend + Opus/Sonnet API fallback for critical tasks |
| ChatGPT Plus | $20 | Codex CLI backend + backup |
| GitHub Copilot Pro | $10 | GPT-4.1 + GPT-5 mini + GPT-4o (0x unlimited) + 300 premium req/mo budget |
| Gemini API | $0 | Free tier — Paimon primary, heartbeats |
| **Total** | **$130/mo** | Down from ~$1,750+/mo on direct API |

#### How It Actually Works

| Layer | Model | Cost | Used For |
|-------|-------|------|----------|
| **Demon thinking** (planning, routing, analysis) | GPT-4.1 / GPT-5 mini via Copilot proxy | $0 (0x unlimited) | 5 demons (Buer, Alloces, Dantalion, Andromalius, Malphas) |
| **Orchestration** | Claude Sonnet 4.5 (MAX sub) | Covered by $100/mo | Calcifer only (primary orchestrator) |
| **Research & docs** | Gemini 2.5 Flash (free tier) | $0 (Gemini free) | Paimon, heartbeats, bulk processing |
| **Heavy coding** | Claude Code CLI (MAX sub) | Covered by $100/mo | Multi-file refactors, deep analysis, security audits |
| **Rapid generation** | Codex CLI (Plus sub) | Covered by $20/mo | Scaffolding, prototyping, boilerplate |
| **Critical decisions** | Claude Opus API (MAX sub) | Covered by $100/mo | Calcifer/Andromalius escalation only |
| **Premium proxy models** | Claude Sonnet/Haiku via proxy | 300 req/mo budget | Emergency fallback, NOT routine use |

**Key insight**: Demons do their *thinking* on free models, but *execute* heavy work through CLI backends (Claude Code / Codex) which are covered by existing subscriptions. The Copilot proxy's premium models (Claude, GPT-5) are avoided for routine use — they eat into the 300/mo budget.

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
- [ ] Demon Health Dashboard shows all 7 demons with status
- [ ] Demon Health Dashboard updates in real time (working/idle transitions)
- [ ] Task Kanban shows queued/in-progress/done columns
- [ ] Task Kanban auto-tracks delegation events
- [ ] Session Replay plays back messages with controls
- [ ] Session Replay "Follow delegation" links to child session
- [ ] Demon Templates appear in Create Agent modal
- [ ] Creating agent from template pre-fills soul file + model
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
