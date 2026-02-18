# The Fireplace — Parallel Phase Plan

## Current State (2026-02-18)

Build health:
- `pnpm tsc --noEmit` passes
- `pnpm build` passes
- `cargo check` passes

Stability/security baseline already in place:
- Rust-side Ed25519 signing + keychain-backed keys
- Keychain device token storage
- Chat normalization and stream fallback handling
- Watchdog + reconnect + visibility checks
- Presence/event cleanup and store conflict fixes

## Already Implemented (Do Not Re-plan)

1. Chat raw JSON rendering regressions fixed
2. Model switching baseline fixed (store/view integration)
3. DemonChat subscription lifecycle/event queue race fixes
4. Keychain migration for device auth signing
5. Toast/loading/error integration across major stores
6. Import consistency cleanup in touched files
7. Chat sync response race fix — streaming state set before await, broken sendResponse check removed
8. Event subscription reconnect race fix — replaced dynamic `import('./connection')` with static import, eliminated async IIFE in `subscribeToEvents`
9. Stream watchdog hardening — initial watchdog started in `sendMessage`, watchdog refresh on every event (not conditional)
10. Poll fallback robustness — polls use fresh `getState()` refs, 30s timeout reloads full history
11. Gateway metadata stripping — timestamp prefixes, System: lines, conversation info blocks (with/without code fences), `[[reply_to_current]]` markers

## Phase Structure

Each phase is designed for parallel execution by multiple agents.

Legend:
- `A` = Agent A workstream
- `B` = Agent B workstream
- `C` = Agent C workstream
- `D` = Agent D workstream

## Phase 14 — Product Correctness (Parallel, Highest Priority)

Goal:
- Eliminate user-visible behavior mismatches between UI and actual gateway behavior.

### A. Chat payload fidelity
Scope:
- Ensure attachments are actually sent to gateway (not only rendered locally).
Files:
- `src/stores/chat.ts`
- `src/views/Chat.tsx`
Acceptance:
- Sending image/file attachments results in gateway-received attachment content.
- If gateway/method doesn’t support attachment payload shape, UI clearly disables or warns.

### B. Chat session config truthfulness
Scope:
- Align config controls with what backend actually uses.
Files:
- `src/stores/chat.ts`
- `src/views/Chat.tsx`
Acceptance:
- `model`, `thinkingLevel`, `temperature`, `maxTokens`, `systemPrompt` are either:
  - transmitted/applied correctly, or
  - hidden/disabled with explicit explanation.

### C. Cron expression validation hardening
Scope:
- Replace simplistic regex validation with parser-backed validation.
Files:
- `src/views/Cron.tsx`
Acceptance:
- Standard expressions like `*/5 * * * *` and `0 9 * * 1-5` validate.
- Parser error messages are specific and surfaced to user.

### D. Mention UX (caret anchoring)
Scope:
- Position @mention suggestion popover at textarea caret.
Files:
- `src/views/DemonChatRoom.tsx`
Acceptance:
- Dropdown tracks cursor location in multi-line input.
- Keyboard handling remains non-invasive for normal typing.

### E. Project memory/docs alignment
Scope:
- Update project memory to reflect current Rust/keychain device auth architecture.
- Remove stale references that imply JS-managed private keys.
Files:
- `.claude/CLAUDE.md`
- `README.md` (if needed for consistency)
Acceptance:
- No guidance remains that suggests storing or managing device private keys in JS/local storage.
- Conventions reflect current gateway/client behavior.

## Phase 15 — Runtime Hardening (Parallel)

Goal:
- Increase multi-window reliability and operability under reconnect/failure conditions.

### A. Deterministic leader election
Scope:
- Replace heartbeat-only contention logic with deterministic contender/tie-break behavior.
Files:
- `src/gateway/client.ts`
Acceptance:
- No dual-leader window under simultaneous startup.
- Follower takeover occurs quickly on leader release/disconnect.

### B. Connection diagnostics surface
Scope:
- Expose internal client health in UI.
Files:
- `src/gateway/client.ts`
- `src/stores/connection.ts`
- `src/views/` (new diagnostics view)
Acceptance:
- UI shows: last tick age, reconnect backoff countdown, rate-limit queue depth, leadership status.

### C. State reconciliation controls
Scope:
- Operator-triggered refresh and stale-state indicators.
Files:
- `src/stores/connection.ts`
- impacted stores/views
Acceptance:
- Manual resync action exists.
- Stale indicator appears when sequence-gap refreshes occur repeatedly.

## Phase 16 — Access Modes & Mission Control Expansion (Parallel)

Goal:
- Make Fireplace safer for remote usage patterns and better for observability-only scenarios.

### A. Connection profiles
Scope:
- Add explicit profile modes: Local trusted, Tailnet trusted.
Files:
- `src/stores/connection.ts`
- settings/config views
Acceptance:
- Profile selection changes safety behavior and connection constraints.
- Unsafe direct-mode combinations are blocked or require explicit override.

### B. Optional proxy transport adapter (R&D / future toggle)
Scope:
- Add adapter path for HTTP proxy (`/tools/invoke`) usage.
Files:
- gateway transport layer + connection store
Acceptance:
- App can run with either direct WS or proxy adapter via config/profile.
- Remains optional and does not add complexity to the default personal-native workflow.

### C. Read-only Ops board
Scope:
- Add non-mutating dashboard route for status/health visibility.
Files:
- new view/store selectors
Acceptance:
- Route exposes no mutation actions.
- Shows connection, cron freshness, errors, model/session status summary.

## Phase 17 — Quality Gates (Cross-Phase, Continuous)

This phase runs after each batch in Phases 14-16.

Required checks:
1. `pnpm tsc --noEmit`
2. `pnpm build`
3. `cd src-tauri && cargo check`

Review gates:
1. No duplicate imports from same module in changed files
2. No new store field/method mismatch (interface vs initializer)
3. No unresolved loading state on error paths

## Suggested Parallel Assignment Matrix

Phase 14:
- Agent A: Chat payload fidelity
- Agent B: Session config truthfulness
- Agent C: Cron parser validation
- Agent D: Mention caret anchoring
- Agent E: Project memory/docs alignment

Phase 15:
- Agent A: Leader election hardening
- Agent B: Diagnostics UI
- Agent C: Reconciliation controls
- Agent D: Regression verification and cross-store tests

Phase 16:
- Agent A: Connection profiles
- Agent B: Proxy adapter
- Agent C: Read-only ops board
- Agent D: Security/permission UX and docs cleanup

## Notes

- This plan intentionally removes stale completed bug lists and keeps only active, actionable work.
- Detailed findings were converted into this phased backlog.
- External landscape research remains in: `docs/OPENCLAW_MISSION_CONTROL_IMPROVEMENTS.md`.
