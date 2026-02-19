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

---

## Phase 18 — Mission Control Pattern Adoption (Full Overhaul)

Goal:
- Adopt a richer UI component layer, reusable DataTable, proper charts, view decomposition, testing scaffolding, and utility improvements inspired by Mission Control.
- Preserve all existing gateway behavior and protocol correctness while refactoring.

Current pain points:
- 13/16 views over 200 lines (Cron: 1395, Chat: 998, Agents: 933, Sessions: 867)
- Only 3 shadcn/ui components (`button`, `input`, `command`); most UI is inline Tailwind
- No testing framework
- Usage charts are CSS `<div>` bars instead of chart primitives
- Status indicators and modal patterns are repeated inline

Hard guardrails (apply to all 18.x steps):
- No protocol drift: every `request('<method>')` must keep method name and params schema-valid.
- No behavior regressions in chat/session/cron/agent flows.
- No `any` / no `@ts-ignore` additions.
- Design system remains dark-only (zinc base + amber accent).

### 18.0 — Foundation (Dependencies + Scaffolding)

Status: partially done (runtime deps already installed).

Install dev dependencies:
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create:
- `vitest.config.ts` (jsdom env, `@/` alias)
- `src/test/setup.ts` (`@testing-library/jest-dom`)

Modify:
- `package.json`: add `"test": "vitest"`, `"test:run": "vitest run"`
- `tsconfig.json`: add `"types": ["vitest/globals"]` (or test-only tsconfig include)

Create directories:
```
src/components/atoms/
src/components/molecules/
src/components/organisms/
src/test/
```

Acceptance:
- `pnpm test:run` executes (can be zero tests initially, but harness boots cleanly).
- Typecheck/build still pass.

### 18.0B — Gateway Stability Prerequisite (Blocking)

Reason: known gateway correctness issues must be fixed before UI overhaul sign-off.

Scope:
- Leader election deterministic tie-break for simultaneous contenders.
- Follower takeover when leader heartbeat is lost.
- Keep follower watcher lifecycle active until claim/promotion outcome.

Acceptance:
- Multi-tab simulation proves exactly one active leader at a time.
- Follower promotes after leader death within timeout window.
- No duplicate websocket connection storms.

### 18.1 — shadcn/ui Expansion + Atoms

Build reusable dark-only primitives, matching existing `button.tsx` style (cva + `cn` + forwardRef where needed).

New UI components (`src/components/ui/`):
- `badge.tsx`
- `card.tsx`
- `dialog.tsx`
- `tabs.tsx`
- `tooltip.tsx`
- `select.tsx`

New atoms (`src/components/atoms/`):
- `StatusDot.tsx` (`online|busy|warning|error|offline`, `size`, `pulse`)
- `StatusPill.tsx` (status-to-badge mapping)
- `ModelBadge.tsx` (model + tier presentation)

Tests:
- `src/test/atoms.test.tsx` for variant/class mapping and rendering behavior.

Acceptance:
- Components are used in at least one production view each.
- No light-mode classes introduced.

### 18.2 — DataTable Component

Create `src/components/organisms/DataTable.tsx` using `@tanstack/react-table`.

Required features:
- Generic typed columns/data
- Sorting with clickable headers
- Loading skeleton rows
- Empty state handling
- Optional row click + sticky header

Tests:
- `src/test/DataTable.test.tsx` for render, empty state, sorting.

Acceptance:
- At least one existing table migrated with parity.

### 18.3 — Recharts for Usage View

Create `src/components/organisms/UsageCharts.tsx` with:
- `ModelDistributionChart`
- `DemonUsageChart`
- `SessionActivityChart`

Notes:
- Usage data is snapshot/aggregate only (not time-series).

Modify:
- `src/views/Usage.tsx` to replace CSS bars with chart components.

Acceptance:
- No loss of displayed metrics vs pre-refactor view.
- Responsive layout works at mobile and desktop widths.

### 18.4 — View Decomposition

Depends on 18.1 + 18.2. Sub-phases may run in parallel.
Primary KPI: behavioral parity first, LOC reduction second.

#### 18.4A — Chat decomposition
- Extract `SessionSelector`, `SessionConfigPanel`, `MessageBubble`, `MessageInput`, `InjectNoteModal`.
- Keep `views/Chat.tsx` as orchestration shell.
- Replace raw selects/modals with `Select`/`Dialog`.

Parity checks:
- Send, abort, inject, history, stream lifecycle unchanged.
- Attachments, thinking, model patch-before-send unchanged.

#### 18.4B — Cron decomposition
- Extract `CronJobCard`, `CronExecHistory`, `CronCreateModal`.
- Keep `views/Cron.tsx` orchestration + filters + table wiring.

Parity checks:
- `cron.add/update/remove/run/runs/list/status` payloads unchanged.
- Validator behavior unchanged (5-7 fields, step-range warning).

#### 18.4C — Agents decomposition
- Extract `AgentCard`, `AgentEditor`, `TemplatePickerModal`.
- Keep `views/Agents.tsx` list/detail shell.

Parity checks:
- `agents.update` payload stays schema-whitelisted.
- File editor save path unchanged (`agents.files.set`).

#### 18.4D — Sessions decomposition
- Extract `SessionPreviewModal`, `SessionConfigModal`, `SessionUsageModal`.
- Keep `views/Sessions.tsx` table + modal triggers.

Parity checks:
- `sessions.list/patch/reset/delete/compact/usage` flows unchanged.
- Session selection still updates chat active session.

Acceptance for 18.4:
- Target views each below ~350 lines (guideline, not hard fail).
- All parity checks pass for each sub-phase.

### 18.5 — Utilities + Settings

Can run after 18.0 (not blocked on 18.1).

#### 18.5A — Optimistic Mutation Helper

Create `src/lib/optimistic.ts`:
```ts
export async function optimisticMutation<TState, TResult>(
  get: () => TState,
  set: (partial: Partial<TState>) => void,
  options: {
    snapshot: (state: TState) => Partial<TState>;
    apply: (state: TState) => Partial<TState>;
    execute: () => Promise<TResult>;
    errorMessage?: string;
  }
): Promise<TResult>
```

Apply to delete operations in `stores/sessions.ts` and `stores/agents.ts`.

Tests:
- `src/test/optimistic.test.ts` (success + rollback path).

#### 18.5B — Gateway URL Settings

Create `src/components/organisms/GatewaySettings.tsx`:
- URL input
- Save+Reconnect
- Reset to default
- Persist through `@tauri-apps/plugin-store`

Modify:
- `src/stores/connection.ts`: `initGatewayUrl()`, persist in `setGatewayUrl()`
- `src/App.tsx`: initialize URL before first connect
- `src/views/Config.tsx`: render gateway settings section

Acceptance:
- URL persists across app restart.
- Invalid URL path surfaces user-facing error.

### 18.6 — Sweep: Replace Inline Patterns Everywhere

Depends on 18.1 + 18.2 + 18.4.
Execute in small slices to reduce blast radius:
1. Dialog/modal normalization
2. Status dots/pills
3. Select replacement
4. Card and ModelBadge replacement
5. DataTable migrations

Exact migration map:
- Select: `Config`, `Models`
- Dialog: `Devices`, `Config`, `SessionReplay`
- StatusDot: `Channels`, `Devices`, `DemonHealth`, `Sidebar`, `ConnectionStatus`
- StatusPill: `Approvals`, `Cron`, `Devices`, `Skills`, `DemonKanban`
- Card: `DemonHealth`, `DemonKanban`, `Approvals`, `Skills`
- DataTable: `Devices`, `Skills`, `Channels`
- ModelBadge: `Models`, `Usage`, `Agents`

Acceptance:
- Per-slice screenshots + behavior checks complete before next slice.

### 18.7 — Tests + Validation (Release Gate)

Test files:
- `src/test/atoms.test.tsx`
- `src/test/DataTable.test.tsx`
- `src/test/optimistic.test.ts`
- `src/test/store-helpers.test.ts`

Contract checks (mandatory):
- Verify all gateway method strings used in app exist in the gateway method registry (`src/gateway/types.ts`) and the protocol schema set in `docs/protocol/schema/` (via `/protocol-check`).
- Verify request param shapes for critical flows:
  - `chat.send/abort/inject/history`
  - `sessions.patch/list/usage`
  - `agents.update/files.set`
  - `cron.add/update/remove/run/runs`

Validation checklist:
1. `pnpm build` passes (`tsc && vite build`)
2. `pnpm test:run` passes
3. `pnpm format` for `src/**/*` and root config files (`vitest.config.ts`, tsconfigs if touched)
4. Manual smoke across all views: connect, chat send, session create/delete, cron add/run, agent file save
5. Multi-tab gateway sanity (leader/follower behavior) passes

Current status (2026-02-19):
- Done: `pnpm build` passing (warnings only)
- Done: `pnpm test:run` passing (17/17)
- Done: `pnpm format` clean
- Done: contract method checks against gateway registry + schema set (critical flows verified in stores/views)
- Remaining: manual smoke across all views
- Remaining: multi-tab gateway sanity verification

### Execution Order

```
18.0 -> 18.0B -> (18.1 | 18.2 | 18.3 | 18.5)
18.1 + 18.2 -> 18.4
18.4 -> 18.6
18.6 + 18.5 + 18.3 -> 18.7
```

### Files Summary (estimated)

- ~25 new files
- ~22 modified files
- 0 deleted files (in-place replacement strategy)
