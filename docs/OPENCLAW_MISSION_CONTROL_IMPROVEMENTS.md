# OpenClaw Frontend / Mission Control Research

## Scope
This memo summarizes how people are building OpenClaw frontends and mission-control surfaces in early 2026, then maps that to concrete improvements for **The Fireplace** (Tauri v2 + React 19 + TypeScript).

## What People Are Building

### 1. Official pattern: direct WebSocket control UI
OpenClaw’s official Control UI is a small Vite + Lit SPA served by the gateway and connected directly to the gateway WebSocket on the same port.

Observed characteristics:
- Direct WS handshake (`connect.challenge` -> `connect`) with auth + device identity.
- Rich admin surface in one UI: chat, sessions, cron, skills, nodes, approvals, config, logs.
- Strong warnings that this is an admin surface and should not be publicly exposed.
- Heavy emphasis on Tailscale Serve / localhost and pairing.

Implication for Fireplace:
- Your current native-first direct-client approach is aligned with the official architecture.

### 2. Community pattern: server-side proxy dashboards
Community “mission control” builds often use a server-side client (e.g., Next.js API routes) that calls `POST /tools/invoke` with bearer auth, then exposes sanitized API responses to the browser UI.

Observed reasons:
- Avoid exposing gateway token to browser runtime.
- Simplify deployment for remote web dashboards.
- Normalize tool envelopes into UI-friendly JSON.

Implication for Fireplace:
- Add an optional “proxy mode” for remote/web companion dashboards while keeping native direct WS as default.

### 3. Community pattern: split monitoring plane from control plane
Some community dashboards are static/near-static status boards fed by periodic collectors (cron + JSON), separate from interactive control.

Observed reasons:
- Reliability during gateway churn/restarts.
- Fast incident visibility (CPU/disk/uptime/sessions/alerts) without requiring full control connection.
- Safer read-only sharing.

Implication for Fireplace:
- Add a read-only Ops view fed by snapshots, independent from interactive gateway control state.

## Recommendations For The Fireplace

## Priority 0 (Do Next)
1. Add explicit **connection profiles**:
- `Local trusted` (direct WS, device pairing).
- `Tailnet trusted` (wss/tailscale serve).
- `Remote untrusted` (proxy mode only, no direct WS token persistence).

2. Add **transport strategy toggle**:
- Direct WS client (current default).
- HTTP tools proxy adapter (`/tools/invoke`) for secure remote usage.

3. Add **admin-surface guardrails** in-app:
- If URL is non-local/non-tailnet and direct mode is selected, show blocking warning + require explicit override.
- Surface when gateway is using insecure auth fallback.

4. Add **pairing + token lifecycle center**:
- Pending pair requests, rotate/revoke device tokens, and quick troubleshooting for 1008 unauthorized/pairing-required states.

## Priority 1 (Near-Term)
1. Build a **read-only Ops board**:
- Gateway reachability, reconnect flaps, queue depth, recent errors, cron freshness, model availability.
- Keep visible even if chat/interactive stores are not ready.

2. Add **state reconciliation controls**:
- Manual “resync from snapshot” and per-store “last event seq/stateVersion” diagnostics.
- Explicit stale badge when event stream gaps are detected.

3. Add **approval workflow hardening**:
- Approval latency, timeout rate, top denied commands, allowlist hit-rate.
- Fast jump from approval event to related session/run.

4. Add **remote-dev safety UX**:
- Built-in support for per-profile allowed origins + gateway URL validation for cross-origin dev.

## Priority 2 (Strategic)
1. Introduce a **headless companion service** for Fireplace web companion:
- Keeps secrets server-side.
- Exposes least-privilege endpoints for dashboards.
- Enables safe shared mission-control links without exposing gateway admin credentials.

2. Add **policy simulation mode**:
- Dry-run expected allow/deny outcomes for exec approvals and tool policy before applying.

3. Add **incident timeline view**:
- Unified stream: gateway reconnects, shutdown events, cron failures, approval denials, model empty-list events.

## Concrete Product Changes (Mapped To Your Current App)

1. Security
- Keep Ed25519 signing in Rust (already done).
- Move any remaining gateway auth token persistence to OS secure storage only.
- Add per-profile secret scope (work/personal lab/home gateway).

2. Reliability
- Keep your current watchdog + leader election architecture, but expose health internals in UI:
  - last tick age
  - leader/follower status
  - reconnect backoff countdown
  - dropped/queued request counters

3. Model/session UX
- Add explicit “no models returned” handling everywhere model selection exists.
- Add one-click fallback selection strategy for empty model lists.

4. Observability
- Add export bundle for support/debug:
  - sanitized connection state
  - recent event ring buffer
  - store-level loading/error durations

## Suggested 30/60/90 Plan

### 30 days
- Connection profiles
- Transport toggle (direct vs proxy)
- Pairing/token lifecycle center
- Ops board v1

### 60 days
- Store reconciliation diagnostics
- Approval metrics + latency tracking
- Incident timeline v1

### 90 days
- Companion service for safe remote dashboards
- Policy simulation + change preview

## Notes On Evidence Quality
- Official docs are authoritative for protocol, security model, and control UI behavior.
- Community mission-control examples are useful for architecture patterns (proxy mode, status collectors) but should be treated as implementation inspiration, not canonical spec.

## Sources
- OpenClaw Control UI docs: https://docs.openclaw.ai/web/control-ui
- OpenClaw Gateway protocol docs: https://docs.openclaw.ai/gateway/protocol
- OpenClaw Dashboard docs: https://docs.openclaw.ai/web/dashboard
- OpenClaw Web interfaces overview: https://docs.openclaw.ai/web
- OpenClaw Security docs: https://docs.openclaw.ai/gateway/security
- OpenClaw Tools Invoke HTTP API: https://docs.openclaw.ai/gateway/tools-invoke-http-api
- OpenClaw Exec approvals docs: https://docs.openclaw.ai/tools/exec-approvals
- Community Next.js mission-control pattern (gist): https://gist.github.com/bdennis-dev/6ddd4d0647a90d3f72db64825ed50d66
- Community static monitoring dashboard pattern (gist): https://gist.github.com/rodbland2021/f71b8693c058152b5a9c7165746b1f74
