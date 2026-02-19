#!/bin/zsh
# =============================================================================
# The Fireplace — Phase 18 Mission Control Overhaul Launcher
# =============================================================================
# Launches Claude Code agents in parallel waves via tmux, each on its own
# git worktree branch.
#
# Dependency graph (from PLAN.md):
#   18.0 -> 18.0B -> (18.1 | 18.2 | 18.3 | 18.5) -> merge
#   18.1 + 18.2 -> (18.4A | 18.4B | 18.4C | 18.4D) -> merge
#   18.4 + 18.5 + 18.3 -> 18.6 -> 18.7
#
# Usage:
#   ./scripts/launch-overhaul.sh --prereqs     # Wave 0: foundation + gateway fix (main branch)
#   ./scripts/launch-overhaul.sh --wave1       # Wave 1: components + charts + utils (4 agents)
#   ./scripts/launch-overhaul.sh --wave2       # Wave 2: view decomposition (4 agents)
#   ./scripts/launch-overhaul.sh --wave3       # Wave 3: sweep + tests (2 agents)
#   ./scripts/launch-overhaul.sh --merge       # Merge current wave branches into main
#   ./scripts/launch-overhaul.sh --status      # Check agent progress
#   ./scripts/launch-overhaul.sh --clean       # Remove all worktrees
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - pnpm installed
#   - Runtime deps already installed (Phase 18.0 partial — done)
# =============================================================================

set -uo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
NC=$'\033[0m'
BOLD=$'\033[1m'

PROJECT_ROOT="${0:A:h:h}"
WORKTREE_BASE="${PROJECT_ROOT:h}"
TMUX_SESSION="overhaul"

# ── Agent definitions by wave ──

WAVE1_NAMES=(shadcn-atoms datatable recharts-usage utils-settings)
WAVE2_NAMES=(decomp-chat decomp-cron decomp-agents decomp-sessions)
WAVE3_NAMES=(sweep-all tests-validation)

ALL_NAMES=($WAVE1_NAMES $WAVE2_NAMES $WAVE3_NAMES)

typeset -A LABELS
LABELS=(
  shadcn-atoms      "18.1  │ shadcn/ui + Atoms"
  datatable         "18.2  │ DataTable Component"
  recharts-usage    "18.3  │ Recharts + Usage View"
  utils-settings    "18.5  │ Optimistic Helper + Gateway Settings"
  decomp-chat       "18.4A │ Chat Decomposition"
  decomp-cron       "18.4B │ Cron Decomposition"
  decomp-agents     "18.4C │ Agents Decomposition"
  decomp-sessions   "18.4D │ Sessions Decomposition"
  sweep-all         "18.6  │ Inline Pattern Sweep"
  tests-validation  "18.7  │ Tests + Validation"
)

typeset -A BRANCHES
for NAME in $ALL_NAMES; do
  BRANCHES[$NAME]="overhaul/$NAME"
done

# ── Agent prompts ──

typeset -A PROMPTS

PROMPTS[shadcn-atoms]='Read .claude/CLAUDE.md and PLAN.md (section 18.1) first. Follow all project conventions strictly.

You are building the reusable shadcn/ui component expansion and atom components for Phase 18.1 of the Mission Control overhaul.

HARD GUARDRAILS:
- No `any` types, no `@ts-ignore`
- Dark-only design: zinc base + amber accent. Strip ALL light-mode classes from shadcn defaults.
- Follow the existing `src/components/ui/button.tsx` pattern exactly: cva + cn + forwardRef where applicable.
- No protocol changes. No gateway interaction. Pure UI components.

YOUR FILES (only create/modify these):

1. `src/components/ui/badge.tsx` — NEW. cva-based Badge component.
   6 variants: default (bg-zinc-800 text-zinc-100), outline (border border-zinc-700 text-zinc-300), accent (bg-amber-500/20 text-amber-400 border-amber-500/30), success (bg-emerald-500/20 text-emerald-400 border-emerald-500/30), warning (bg-amber-500/20 text-amber-400 border-amber-500/30), danger (bg-red-500/20 text-red-400 border-red-500/30).
   Base: inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium.
   Export Badge and badgeVariants.

2. `src/components/ui/card.tsx` — NEW. Simple div-based Card compound component.
   Card: rounded-xl border border-zinc-700 bg-zinc-900
   CardHeader: p-3 border-b border-zinc-800
   CardContent: p-3
   CardTitle: text-sm font-semibold text-zinc-100
   CardDescription: text-xs text-zinc-400
   Export all parts.

3. `src/components/ui/dialog.tsx` — NEW. Wrap @radix-ui/react-dialog.
   Overlay: fixed inset-0 bg-black/50 z-50, animate fade-in
   Content: fixed top-1/2 left-1/2 -translate centered, bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl, max-w-lg w-full, p-0
   DialogHeader: p-4 border-b border-zinc-800
   DialogFooter: p-4 border-t border-zinc-800 flex justify-end gap-2
   DialogTitle: text-lg font-semibold text-zinc-100
   DialogDescription: text-sm text-zinc-400
   DialogClose: styled close button
   Export: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose.

4. `src/components/ui/tabs.tsx` — NEW. Wrap @radix-ui/react-tabs.
   TabsList: inline-flex gap-1 rounded-lg bg-zinc-800/50 p-1
   TabsTrigger: rounded-md px-3 py-1.5 text-sm text-zinc-400, data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950
   TabsContent: mt-2
   Export: Tabs, TabsList, TabsTrigger, TabsContent.

5. `src/components/ui/tooltip.tsx` — NEW. Wrap @radix-ui/react-tooltip.
   Content: bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200, sideOffset=6
   Export: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.

6. `src/components/ui/select.tsx` — NEW. Wrap @radix-ui/react-select.
   Trigger: flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100, focus:border-amber-500
   Content: bg-zinc-900 border border-zinc-700 rounded-md shadow-xl overflow-hidden
   Item: px-2 py-1.5 text-sm text-zinc-300 cursor-pointer, data-[highlighted]:bg-zinc-800 data-[highlighted]:text-zinc-100
   Viewport, Label, Separator, ScrollUpButton, ScrollDownButton as needed.
   Export: Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator.

7. `src/components/atoms/StatusDot.tsx` — NEW.
   Props: status: "online" | "busy" | "warning" | "error" | "offline", size?: "sm" | "md" (default sm), pulse?: boolean
   Color map: online=bg-emerald-500, busy=bg-amber-500, warning=bg-amber-500, error=bg-red-500, offline=bg-zinc-500
   Size: sm=h-2 w-2, md=h-2.5 w-2.5. Always rounded-full.
   pulse adds animate-pulse class.

8. `src/components/atoms/StatusPill.tsx` — NEW.
   Props: status: string, label?: string
   Maps status strings to Badge variants: connected/online/healthy/active → success, error/failed/dead → danger, warning/degraded → warning, idle/offline/unknown → default.
   Uses the label prop or capitalizes the status as display text.
   Import Badge from ../ui/badge.

9. `src/components/atoms/ModelBadge.tsx` — NEW.
   Props: model: string, tier?: string
   Uses classifyModel from @/lib/modelTiers to get tier info.
   Renders a Badge with tier-appropriate variant: free → success, cheap → accent, premium → warning, max → outline, unknown → default.
   Display text: split model on "/" and show the model part (second half).

10. `src/App.tsx` — MODIFY. Wrap the app content with TooltipProvider from the new tooltip component. Place it inside BrowserRouter but around everything else.

Create directories if they do not exist:
- src/components/atoms/
- src/components/molecules/
- src/components/organisms/

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[datatable]='Read .claude/CLAUDE.md and PLAN.md (section 18.2) first. Follow all project conventions strictly.

You are building the reusable DataTable component for Phase 18.2.

HARD GUARDRAILS:
- No `any` types, no `@ts-ignore`
- Dark-only design: zinc base + amber accent
- No protocol changes. Pure UI component.

YOUR FILES (only create these):

1. `src/components/organisms/DataTable.tsx` — NEW.
   Generic wrapper around @tanstack/react-table.

   Props interface (generic TData):
   - columns: ColumnDef<TData, unknown>[]
   - data: TData[]
   - isLoading?: boolean (default false)
   - emptyMessage?: string (default "No data")
   - emptyDetail?: string
   - onRowClick?: (row: TData) => void
   - stickyHeader?: boolean (default false)

   Features:
   - useReactTable with getCoreRowModel + getSortedRowModel
   - Clickable column headers toggle sorting. Show ▲/▼ indicator on sorted column.
   - Header row: text-xs font-medium text-zinc-500 uppercase tracking-wider, border-b border-zinc-700, bg-zinc-800/50
   - Body rows: border-b border-zinc-700/50 last:border-0, hover:bg-zinc-800/50 transition-colors
   - If onRowClick provided: cursor-pointer on rows
   - If stickyHeader: sticky top-0 z-10 on thead
   - Loading state: render 5 skeleton rows (h-4 bg-zinc-800 rounded animate-pulse) matching column count
   - Empty state: use EmptyState from @/components/StateIndicators with emptyMessage and emptyDetail
   - Cell padding: px-3 py-2, text-sm text-zinc-100
   - Table container: overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900
   - Table: w-full text-left

   Import getCoreRowModel, getSortedRowModel, flexRender, useReactTable from @tanstack/react-table.
   Import type { ColumnDef, SortingState } from @tanstack/react-table.

   Create the organisms/ directory if it does not exist.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[recharts-usage]='Read .claude/CLAUDE.md and PLAN.md (section 18.3) first. Follow all project conventions strictly.

You are adding Recharts-based charts and updating the Usage view for Phase 18.3.

HARD GUARDRAILS:
- No `any` types, no `@ts-ignore`
- Dark-only: zinc base + amber accent
- No protocol changes. Keep all existing request() calls and method names exactly as they are.
- No loss of displayed metrics compared to the current view.

YOUR FILES (only create/modify these):

1. `src/components/organisms/UsageCharts.tsx` — NEW.

   Three named exports:

   a) ModelDistributionChart — Props: { distribution: { tier: string; tokenCount: number; percentage: number }[] }
      Horizontal BarChart showing tokens per tier.
      Use ResponsiveContainer width="100%" height={250}.
      Bar colors by tier: Free=emerald-500 (#10b981), "Low Cost"=sky-500 (#0ea5e9), Premium=amber-500 (#f59e0b), "MAX Sub"=violet-500 (#8b5cf6), Unknown=zinc-500 (#71717a).
      Custom tooltip: bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm.
      XAxis/YAxis: tick fill=#a1a1aa (zinc-400), fontSize=12.
      CartesianGrid: vertical={false} stroke=#3f3f46 (zinc-700).

   b) DemonUsageChart — Props: { demons: { demonId: string; demonName: string; totalTokens: number; model: string }[] }
      Vertical BarChart comparing demons by totalTokens.
      Use ResponsiveContainer width="100%" height={250}.
      Bar fill: #f59e0b (amber-500). ActiveBar fill: #fbbf24 (amber-400).
      Same tooltip/grid/axis styling as above.

   c) SessionActivityChart — Props: { sessions: { name: string; totalTokens: number; inputTokens: number; outputTokens: number }[] }
      Stacked vertical BarChart showing top 10 sessions by total tokens.
      Two bars per session: inputTokens (#a1a1aa zinc-400) and outputTokens (#f59e0b amber-500).
      Same tooltip/grid/axis styling.
      Truncate session names to 20 chars in XAxis tickFormatter.

   All imports from "recharts": BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell.
   Create the organisms/ directory if it does not exist.

2. `src/views/Usage.tsx` — MODIFY.
   Replace the ModelDistributionBar component (CSS div bars) with ModelDistributionChart.
   Replace DemonUsageGrid (card grid) with DemonUsageChart.
   Add SessionActivityChart before the per-session table section, showing top 10 sessions by totalTokens.
   Keep all existing: SummaryCard, formatTokens, formatCost, formatTimestamp, formatTokensWithCommas helpers.
   Keep the existing per-session table (do NOT replace it with DataTable yet — that happens in Phase 18.6).
   Keep all existing store hooks (useUsageStore, useConnectionStore) and their usage patterns.
   Keep the refresh button, loading/error/empty states, and disclaimer exactly as they are.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[utils-settings]='Read .claude/CLAUDE.md and PLAN.md (sections 18.5A and 18.5B) first. Follow all project conventions strictly.

You are building the optimistic mutation helper and gateway URL settings for Phase 18.5.

HARD GUARDRAILS:
- No `any` types, no `@ts-ignore`
- Dark-only design
- Keep all existing gateway method names and param shapes exactly as they are
- The connection store setGatewayUrl must still work even if @tauri-apps/plugin-store is unavailable (web dev mode)

YOUR FILES (only create/modify these):

1. `src/lib/optimistic.ts` — NEW.
   Export a single generic async function:

   ```
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

   Flow: capture snapshot via options.snapshot(get()) → apply optimistic via set(options.apply(get())) → await options.execute() → on success return result → on error: set(savedSnapshot), toast.error(options.errorMessage || "Operation failed"), re-throw.
   Import toast from "sonner".

2. `src/stores/sessions.ts` — MODIFY.
   Find the deleteSession action (or equivalent). Refactor it to use optimisticMutation:
   - snapshot: save current sessions array
   - apply: filter out the deleted session from the array
   - execute: the existing request("sessions.delete", ...) call
   Keep ALL existing method names and param shapes. Only change the flow pattern.

3. `src/stores/agents.ts` — MODIFY.
   Find the delete agent action (or equivalent). Refactor it to use optimisticMutation similarly.
   Keep ALL existing method names and param shapes.

4. `src/components/organisms/GatewaySettings.tsx` — NEW.
   Props: none (reads from connection store directly).
   UI:
   - Card-style container (rounded-lg border border-zinc-700 bg-zinc-900 p-3)
   - "Gateway Connection" heading (text-sm font-semibold text-zinc-100)
   - URL text input showing current gatewayUrl, editable
   - "Save & Reconnect" button (amber-500 bg): calls setGatewayUrl then disconnect() then connect()
   - "Reset to Default" button (zinc-800 bg): resets to default URL
   - Status indicator: show current connection status text
   Import from @/stores/connection.
   For persistence: try/catch import of @tauri-apps/plugin-store. If available, save URL on set. If not (web dev), just use in-memory state.

5. `src/stores/connection.ts` — MODIFY.
   Add `initGatewayUrl` action:
   - Try to load saved URL from @tauri-apps/plugin-store (key: "gateway-url")
   - If found, call set({ gatewayUrl: savedUrl })
   - If not found or store unavailable, do nothing (keep default)
   - Wrap in try/catch so it never throws
   Modify `setGatewayUrl`:
   - After setting state, also persist to plugin-store (fire-and-forget, try/catch)
   Add initGatewayUrl to the ConnectionState interface.

6. `src/App.tsx` — MODIFY.
   In the startup useEffect, call initGatewayUrl() before connect():
   ```
   initGatewayUrl().then(() => { connect().catch(...) })
   ```
   Import initGatewayUrl from connection store (via useConnectionStore.getState() or destructure).

7. `src/views/Config.tsx` — MODIFY.
   Add a GatewaySettings section at the TOP of the config page, before the existing raw JSON editor.
   Import GatewaySettings from @/components/organisms/GatewaySettings.
   Just render <GatewaySettings /> in a section with a small heading.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[decomp-chat]='Read .claude/CLAUDE.md and PLAN.md (section 18.4A) first. Follow all project conventions strictly.

You are decomposing Chat.tsx (currently ~998 lines) into focused sub-components for Phase 18.4A.

HARD GUARDRAILS:
- BEHAVIORAL PARITY IS MANDATORY. Every feature must work identically after decomposition.
- No `any` types, no `@ts-ignore`
- No protocol changes: keep all request() method names, params, event subscriptions exactly as-is
- Parity checks: send, abort, inject, history, stream lifecycle, attachments, thinking, model patch-before-send — ALL unchanged.
- Dark-only design.

YOUR FILES (only create/modify these):

1. `src/components/molecules/SessionSelector.tsx` — NEW.
   Move the SessionSelector function from Chat.tsx here.
   Replace the raw <select> with the Select component from @/components/ui/select (SelectTrigger, SelectValue, SelectContent, SelectItem).
   Keep ALL existing logic: session loading, active session handling, snapshot/mainSessionKey fallback.
   Props: none (reads from stores directly, same as current).

2. `src/components/molecules/SessionConfigPanel.tsx` — NEW.
   Move the SessionConfigPanel function from Chat.tsx here.
   Replace raw <select> elements with Select components.
   Props: { isOpen: boolean; onClose: () => void }
   Keep ALL existing config fields and their behavior (model, thinkingLevel, temperature, maxTokens).

3. `src/components/molecules/MessageBubble.tsx` — NEW.
   Move these functions from Chat.tsx: isGatewayMetadata, ToolUseBlock, ToolResultBlock, ThinkingBlock, MessageBubble.
   Props for MessageBubble: { message: Message; isStreaming?: boolean }
   Keep ALL existing rendering logic: gateway metadata collapse, content block partitioning, markdown rendering, token counts.
   Import Message type from @/stores/chat, MarkdownRenderer from @/components/MarkdownRenderer.

4. `src/components/molecules/MessageInput.tsx` — NEW.
   Move these functions from Chat.tsx: AttachmentPreview, StreamingIndicator, MessageInput.
   Props for MessageInput: none (reads from chat store directly).
   Keep ALL existing logic: file upload, drag/drop, paste, Cmd+Enter, abort, bulk upload.

5. `src/components/molecules/InjectNoteModal.tsx` — NEW.
   Move InjectNoteModal from Chat.tsx.
   Wrap with Dialog component from @/components/ui/dialog instead of the hand-rolled `fixed inset-0 z-50` pattern.
   Use DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter.
   Props: { open: boolean; onOpenChange: (open: boolean) => void }
   Keep the existing inject logic.

6. `src/views/Chat.tsx` — MODIFY (rewrite to orchestration shell).
   Import all extracted components.
   Keep: the main Chat export, the useEffect hooks for loadHistory, subscribeToEvents, auto-scroll, scroll tracking.
   Keep: the header, messages scroll area, scroll-to-bottom button, error banner.
   Remove: all the inner function definitions that were extracted.
   Target: ~200 lines of orchestration code.

Create the molecules/ directory if it does not exist.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[decomp-cron]='Read .claude/CLAUDE.md and PLAN.md (section 18.4B) first. Follow all project conventions strictly.

You are decomposing Cron.tsx (currently ~1395 lines) into focused sub-components for Phase 18.4B.

HARD GUARDRAILS:
- BEHAVIORAL PARITY IS MANDATORY. Every cron feature must work identically.
- No `any` types, no `@ts-ignore`
- No protocol changes: `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, `cron.list`, `cron.status` payloads must remain EXACTLY as they are.
- Validator behavior unchanged (5-7 fields, step-range warning).
- Dark-only design.

Read the full `src/views/Cron.tsx` first to understand the current structure, then decompose.

YOUR FILES (only create/modify these):

1. `src/components/molecules/CronJobCard.tsx` — NEW.
   Extract the single-job rendering (the expanded job detail panel / job row).
   Use StatusPill from @/components/atoms/StatusPill for job status display.
   Use Badge from @/components/ui/badge for labels/tags.
   Props: the single job object + callbacks for edit/delete/run/toggle actions.
   Keep all existing job detail rendering.

2. `src/components/organisms/CronExecHistory.tsx` — NEW.
   Extract the execution history display and health check rendering.
   Props: runs array + health check data for the selected job.
   Keep all existing formatting and display logic.

3. `src/components/organisms/CronCreateModal.tsx` — NEW.
   Extract the add/edit job form + template picker.
   Wrap with Dialog from @/components/ui/dialog instead of `fixed inset-0 z-50`.
   Props: { open: boolean; onOpenChange: (open: boolean) => void; editJob?: CronJob | null }
   Keep ALL existing form fields, validation, and submit logic.
   Keep the template picker if one exists.

4. `src/views/Cron.tsx` — MODIFY (rewrite to orchestration shell).
   Import all extracted components.
   Keep: header, filter controls (consider using Tabs from @/components/ui/tabs for status filtering if applicable), the job list rendering that delegates to CronJobCard, modal triggers.
   Remove: all inner function definitions that were extracted.
   Target: ~300 lines of orchestration code.

Create directories if they do not exist.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[decomp-agents]='Read .claude/CLAUDE.md and PLAN.md (section 18.4C) first. Follow all project conventions strictly.

You are decomposing Agents.tsx (currently ~933 lines) into focused sub-components for Phase 18.4C.

HARD GUARDRAILS:
- BEHAVIORAL PARITY IS MANDATORY.
- No `any` types, no `@ts-ignore`
- No protocol changes: `agents.update` payload stays schema-whitelisted, `agents.files.set` path unchanged.
- Dark-only design.

Read the full `src/views/Agents.tsx` first to understand the current structure, then decompose.

YOUR FILES (only create/modify these):

1. `src/components/molecules/AgentCard.tsx` — NEW.
   Extract the agent list item rendering.
   Use StatusDot from @/components/atoms/StatusDot for agent online/offline status.
   Use ModelBadge from @/components/atoms/ModelBadge for model display.
   Props: { agent: Agent; isSelected: boolean; onSelect: (agent: Agent) => void }
   Keep existing rendering logic for emoji, name, model badge, status.

2. `src/components/organisms/AgentEditor.tsx` — NEW.
   Extract the CodeMirror file editor section.
   This isolates the heavy @uiw/react-codemirror dependency.
   Props: { agent: Agent } plus any callbacks for file save/select.
   Keep ALL existing file browsing, language detection, save logic.

3. `src/components/organisms/TemplatePickerModal.tsx` — NEW.
   Extract the template picker / create agent modal.
   Wrap with Dialog from @/components/ui/dialog.
   Props: { open: boolean; onOpenChange: (open: boolean) => void }
   Keep ALL existing template selection, form fields, create+soul-file logic.

4. `src/views/Agents.tsx` — MODIFY (rewrite to orchestration shell).
   Import all extracted components.
   Keep: list/detail layout, agent selection state, store hooks, load effects.
   Remove: all inner function definitions that were extracted.
   Target: ~250 lines.

Create directories if they do not exist.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[decomp-sessions]='Read .claude/CLAUDE.md and PLAN.md (section 18.4D) first. Follow all project conventions strictly.

You are decomposing Sessions.tsx (currently ~867 lines) into focused sub-components for Phase 18.4D.

HARD GUARDRAILS:
- BEHAVIORAL PARITY IS MANDATORY.
- No `any` types, no `@ts-ignore`
- No protocol changes: `sessions.list`, `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact`, `sessions.usage` flows must remain exactly as they are.
- Session selection still updates chat active session.
- Dark-only design.

Read the full `src/views/Sessions.tsx` first to understand the current structure, then decompose.

YOUR FILES (only create/modify these):

1. `src/components/organisms/SessionPreviewModal.tsx` — NEW.
   Extract the session preview modal.
   Wrap with Dialog from @/components/ui/dialog instead of `fixed inset-0 z-50`.
   Props: { open: boolean; onOpenChange: (open: boolean) => void }
   Read session data from the sessions store (selectedSession, etc.).
   Keep ALL existing preview rendering.

2. `src/components/organisms/SessionConfigModal.tsx` — NEW.
   Extract the session config editor modal.
   Wrap with Dialog. Replace raw <select> elements with Select from @/components/ui/select.
   Props: { open: boolean; onOpenChange: (open: boolean) => void }
   Keep ALL existing config fields and their submit logic.

3. `src/components/organisms/SessionUsageModal.tsx` — NEW.
   Extract the token usage display modal.
   Wrap with Dialog.
   Props: { open: boolean; onOpenChange: (open: boolean) => void }
   Keep ALL existing usage data display.

4. `src/views/Sessions.tsx` — MODIFY (rewrite to orchestration shell).
   Import all extracted components.
   Keep: session list rendering, store hooks, load effects, session selection, modal trigger state, SessionReplay integration.
   Remove: all inner modal function definitions that were extracted.
   Target: ~250 lines.

Create directories if they do not exist.

When done, run `pnpm format` and `pnpm build` to verify no type errors. Commit your changes with a descriptive message.'

PROMPTS[sweep-all]='Read .claude/CLAUDE.md and PLAN.md (section 18.6) first. Follow all project conventions strictly.

You are executing the inline pattern sweep for Phase 18.6. Replace scattered inline patterns with the new reusable components across ALL remaining views.

HARD GUARDRAILS:
- BEHAVIORAL PARITY for every view you touch.
- No `any` types, no `@ts-ignore`
- No protocol changes whatsoever.
- Dark-only design.
- Work in small slices. After each slice, run `pnpm build` to verify.

Execute in this order:

SLICE 1 — Dialog/modal normalization:
- `src/views/Devices.tsx` — replace any `fixed inset-0 z-50` modals with Dialog
- `src/views/Config.tsx` — replace any hand-rolled modals with Dialog
- `src/components/SessionReplay.tsx` — replace fixed overlay with Dialog

SLICE 2 — Status dots:
- `src/views/Channels.tsx` — replace `rounded-full bg-emerald-500 h-2 w-2` etc. with <StatusDot>
- `src/views/Devices.tsx` — same replacement
- `src/views/DemonHealth.tsx` — same replacement
- `src/components/Sidebar.tsx` — replace connection status dot with <StatusDot>
- `src/components/ConnectionStatus.tsx` — if it exists, replace status dot

SLICE 3 — Status pills:
- `src/views/Approvals.tsx` — replace inline status text with conditional colors with <StatusPill>
- `src/views/Cron.tsx` — same (any remaining after decomp)
- `src/views/Devices.tsx` — same
- `src/views/Skills.tsx` — same
- `src/views/DemonKanban.tsx` — same

SLICE 4 — Card and ModelBadge:
- `src/views/DemonHealth.tsx` — replace inline card divs with <Card>/<CardContent>
- `src/views/DemonKanban.tsx` — same
- `src/views/Approvals.tsx` — same
- `src/views/Skills.tsx` — same
- `src/views/Models.tsx` — replace inline tier badges with <ModelBadge>
- `src/views/Usage.tsx` — same
- `src/views/Agents.tsx` — same (any remaining)

SLICE 5 — Select replacements:
- `src/views/Config.tsx` — replace raw <select> with Select component
- `src/views/Models.tsx` — same

SLICE 6 — DataTable migrations (where appropriate):
- `src/views/Devices.tsx` — replace raw <table> with DataTable
- `src/views/Skills.tsx` — same
- `src/views/Channels.tsx` — same

After EACH slice, run `pnpm build`. Fix any errors before proceeding to next slice.

When all slices complete, run `pnpm format` and `pnpm build` one final time. Commit your changes with a descriptive message.'

PROMPTS[tests-validation]='Read .claude/CLAUDE.md and PLAN.md (section 18.7) first. Follow all project conventions strictly.

You are writing the test suite and performing final validation for Phase 18.7.

HARD GUARDRAILS:
- Tests must actually pass, not just compile.
- No `any` types, no `@ts-ignore`

IMPORTANT: The test harness (vitest + @testing-library/react) should already be set up.
If `vitest.config.ts` or `src/test/setup.ts` do not exist, create them:
- vitest.config.ts: jsdom environment, @/ path alias, setupFiles pointing to src/test/setup.ts
- src/test/setup.ts: import "@testing-library/jest-dom"

YOUR FILES (only create these):

1. `src/test/atoms.test.tsx`
   Test StatusDot: renders correct color class for each status, renders pulse class when pulse=true, renders correct size.
   Test StatusPill: maps "connected" → success badge, "error" → danger badge, "idle" → default badge, custom label overrides status text.
   Test ModelBadge: renders model name (after splitting on "/"), applies correct badge variant for free/cheap/premium/max tiers.
   Import from @/components/atoms/*.

2. `src/test/DataTable.test.tsx`
   Test render: given columns and data, renders correct number of rows and cells.
   Test empty state: given empty data array, renders empty message.
   Test loading: given isLoading=true, renders skeleton rows.
   Test sorting: clicking a column header toggles sort, data reorders.
   Import from @/components/organisms/DataTable.

3. `src/test/optimistic.test.ts`
   Test success path: snapshot captured, optimistic state applied, execute succeeds, final state is post-execute.
   Test rollback path: snapshot captured, optimistic applied, execute throws, state rolled back to snapshot, toast.error called.
   Mock toast from "sonner".
   Import from @/lib/optimistic.

4. `src/test/store-helpers.test.ts`
   Test formatSessionKey: "agent:calcifer:main" → "Calcifer", "agent:buer:task-123" → "Buer (task-123)", "main" → "Main".
   Test cn utility: merges classes correctly, handles conditional classes.
   Import from @/lib/utils.

VALIDATION (run these after tests pass):
1. `pnpm build` — must pass clean (tsc + vite build)
2. `pnpm test:run` — all tests must pass
3. `pnpm format` — run it to fix any formatting drift

Report the results of each validation step. If anything fails, fix it.

When done, commit your changes with a descriptive message.'

# ── Helper functions ──

ok()   { echo "  ${GREEN}✓${NC} $1"; }
warn() { echo "  ${YELLOW}!${NC} $1"; }
fail() { echo "  ${RED}✗${NC} $1"; }

do_status() {
  echo ""
  echo "${BOLD}Phase 18 Agent Status:${NC}"
  echo ""
  for NAME in $ALL_NAMES; do
    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    if [[ -d "$WT_PATH" ]]; then
      local COMMITS=$(cd "$WT_PATH" && git log main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
      local LABEL="${LABELS[$NAME]}"
      if [[ "$COMMITS" -gt 0 ]]; then
        echo "  ${GREEN}✓${NC} $LABEL — ${GREEN}$COMMITS commit(s)${NC}"
      else
        echo "  ${YELLOW}⟳${NC} $LABEL — ${YELLOW}working (no commits yet)${NC}"
      fi
    else
      echo "  ${DIM}·${NC} ${LABELS[$NAME]} — ${DIM}not started${NC}"
    fi
  done
  echo ""
}

do_merge() {
  local WAVE_NAMES=("$@")

  echo ""
  echo "${BOLD}Merging branches into main...${NC}"
  echo ""
  cd "$PROJECT_ROOT" || exit 1
  git checkout main 2>/dev/null

  local MERGED=0
  local FAILED=0

  for NAME in $WAVE_NAMES; do
    local BRANCH="${BRANCHES[$NAME]}"
    if git rev-parse --verify "$BRANCH" &>/dev/null; then
      echo "  ${BLUE}⟳${NC} Merging $BRANCH..."
      if git merge "$BRANCH" --no-edit 2>/dev/null; then
        ok "Merged $BRANCH"
        ((MERGED++))
      else
        fail "Merge conflict on $BRANCH"
        echo "    Resolve manually, then: git merge --continue"
        echo "    Or abort: git merge --abort"
        ((FAILED++))
        return 1
      fi
    else
      echo "  ${DIM}·${NC} Branch $BRANCH does not exist, skipping"
    fi
  done

  if [[ "$MERGED" -eq 0 ]]; then
    echo "  ${DIM}No branches to merge.${NC}"
  else
    echo ""
    ok "Merged $MERGED branch(es) into main."
  fi

  if [[ "$MERGED" -gt 0 ]]; then
    echo ""
    echo "  Running build verification..."
    cd "$PROJECT_ROOT"
    if pnpm build 2>/dev/null; then
      ok "Build passed!"
    else
      warn "Build has errors — check output above"
    fi
  fi
}

do_clean() {
  echo ""
  echo "${BOLD}Cleaning up worktrees...${NC}"
  cd "$PROJECT_ROOT" || exit 1

  local CLEANED=0
  for NAME in $ALL_NAMES; do
    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    if [[ -d "$WT_PATH" ]]; then
      echo "  ${BLUE}⟳${NC} Removing fireplace-$NAME..."
      git worktree remove "$WT_PATH" --force 2>/dev/null
      git branch -D "${BRANCHES[$NAME]}" 2>/dev/null
      ((CLEANED++))
    fi
  done

  if [[ "$CLEANED" -eq 0 ]]; then
    echo "  ${DIM}Nothing to clean.${NC}"
  else
    ok "Removed $CLEANED worktree(s)."
  fi
}

launch_agents() {
  local LAUNCH=("$@")

  echo ""
  echo "${BOLD}${CYAN}🔥 Launching ${#LAUNCH[@]} overhaul agent(s)...${NC}"
  echo ""

  cd "$PROJECT_ROOT" || exit 1

  # Create worktrees and install deps
  for NAME in $LAUNCH; do
    local BRANCH="${BRANCHES[$NAME]}"
    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"

    if [[ ! -d "$WT_PATH" ]]; then
      echo "  ${BLUE}⟳${NC} Creating worktree: fireplace-$NAME"
      git worktree add "$WT_PATH" -b "$BRANCH" 2>/dev/null || {
        git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || {
          fail "Failed to create worktree for $NAME"
          continue
        }
      }
    else
      ok "Worktree exists: fireplace-$NAME"
    fi

    # Install deps in background
    if [[ ! -d "$WT_PATH/node_modules" ]] && [[ -f "$WT_PATH/package.json" ]]; then
      echo "  ${BLUE}⟳${NC} Installing deps in fireplace-$NAME..."
      (cd "$WT_PATH" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null) &
    fi
  done

  wait
  echo ""

  # Launch in tmux
  for NAME in $LAUNCH; do
    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    local PROMPT="${PROMPTS[$NAME]}"

    [[ ! -d "$WT_PATH" ]] && continue

    # Write prompt file
    echo "$PROMPT" > "$WT_PATH/.claude-prompt.txt"

    # Write launcher script
    local LAUNCHER="$WT_PATH/.claude-launch.sh"
    cat > "$LAUNCHER" <<LAUNCHER_EOF
#!/bin/zsh
cd "$WT_PATH"
echo "🔥 Overhaul Agent: $NAME"
echo "   Phase: ${LABELS[$NAME]}"
echo "   Branch: ${BRANCHES[$NAME]}"
echo "   Worktree: $WT_PATH"
echo ""
exec claude "\$(cat .claude-prompt.txt)"
LAUNCHER_EOF
    chmod +x "$LAUNCHER"

    echo "  ${GREEN}🔥${NC} Launching ${BOLD}$NAME${NC}..."

    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      tmux new-session -d -s "$TMUX_SESSION" -n "$NAME" "$LAUNCHER"
    else
      tmux new-window -t "$TMUX_SESSION" -n "$NAME" "$LAUNCHER"
    fi
    ok "Started in tmux ($TMUX_SESSION:$NAME)"

    sleep 1
  done

  echo ""
  echo "${BOLD}All agents launched!${NC}"
  echo ""
  echo "  ${CYAN}Attach:${NC}         ${BOLD}tmux attach -t $TMUX_SESSION${NC}"
  echo "  ${CYAN}Switch window:${NC}  ${BOLD}Ctrl+B, N${NC} (next)  ${BOLD}Ctrl+B, P${NC} (prev)"
  echo "  ${CYAN}List windows:${NC}   ${BOLD}Ctrl+B, W${NC}"
  echo ""
  echo "  Check status:  ${BOLD}./scripts/launch-overhaul.sh --status${NC}"
  echo "  Merge wave:    ${BOLD}./scripts/launch-overhaul.sh --merge-wave1${NC} (or --merge-wave2, --merge-wave3)"
  echo "  Clean up:      ${BOLD}./scripts/launch-overhaul.sh --clean${NC}"
  echo ""
}

do_prereqs() {
  echo ""
  echo "${BOLD}${CYAN}Phase 18.0 — Foundation Setup${NC}"
  echo ""

  cd "$PROJECT_ROOT" || exit 1

  # Dev dependencies
  echo "  ${BLUE}⟳${NC} Installing dev dependencies..."
  if pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom 2>&1; then
    ok "Dev dependencies installed"
  else
    fail "Failed to install dev dependencies"
    return 1
  fi

  # Create directories
  echo "  ${BLUE}⟳${NC} Creating component directories..."
  mkdir -p src/components/atoms src/components/molecules src/components/organisms src/test
  ok "Directories created"

  # vitest.config.ts
  if [[ ! -f vitest.config.ts ]]; then
    echo "  ${BLUE}⟳${NC} Creating vitest.config.ts..."
    cat > vitest.config.ts <<'VITE_EOF'
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
VITE_EOF
    ok "Created vitest.config.ts"
  else
    warn "vitest.config.ts already exists"
  fi

  # src/test/setup.ts
  if [[ ! -f src/test/setup.ts ]]; then
    echo "  ${BLUE}⟳${NC} Creating src/test/setup.ts..."
    cat > src/test/setup.ts <<'SETUP_EOF'
import '@testing-library/jest-dom';
SETUP_EOF
    ok "Created src/test/setup.ts"
  else
    warn "src/test/setup.ts already exists"
  fi

  # package.json scripts
  echo "  ${BLUE}⟳${NC} Adding test scripts to package.json..."
  if ! grep -q '"test"' package.json; then
    # Use node to safely modify JSON
    node -e '
      const fs = require("fs");
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      pkg.scripts.test = "vitest";
      pkg.scripts["test:run"] = "vitest run";
      fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
    '
    ok "Added test/test:run scripts"
  else
    warn "Test scripts already exist"
  fi

  # tsconfig types
  echo "  ${BLUE}⟳${NC} Checking tsconfig.json for vitest globals..."
  if ! grep -q 'vitest/globals' tsconfig.json; then
    node -e '
      const fs = require("fs");
      const raw = fs.readFileSync("tsconfig.json", "utf8");
      const config = JSON.parse(raw);
      if (!config.compilerOptions.types) {
        config.compilerOptions.types = [];
      }
      if (!config.compilerOptions.types.includes("vitest/globals")) {
        config.compilerOptions.types.push("vitest/globals");
      }
      fs.writeFileSync("tsconfig.json", JSON.stringify(config, null, 2) + "\n");
    '
    ok "Added vitest/globals to tsconfig"
  else
    warn "vitest/globals already in tsconfig"
  fi

  # Verify
  echo ""
  echo "  ${BLUE}⟳${NC} Verifying build..."
  if pnpm build 2>&1; then
    ok "Build passes"
  else
    fail "Build failed — check output"
    return 1
  fi

  echo ""
  echo "  ${BLUE}⟳${NC} Verifying test harness..."
  if pnpm test:run 2>&1; then
    ok "Test harness boots"
  else
    warn "Test harness may have issues (could be zero tests)"
  fi

  echo ""
  ok "Phase 18.0 foundation complete!"
  echo ""
  echo "  Next step: ${BOLD}./scripts/launch-overhaul.sh --wave1${NC}"
  echo ""
}

# ── Handle flags ──
case "${1:-}" in
  --prereqs)
    do_prereqs
    exit $?
    ;;
  --wave1)
    echo "${BOLD}Wave 1: shadcn/ui + DataTable + Recharts + Utils (4 parallel agents)${NC}"
    launch_agents $WAVE1_NAMES
    exit 0
    ;;
  --wave2)
    echo "${BOLD}Wave 2: View Decomposition (4 parallel agents)${NC}"
    echo "${DIM}Requires wave1 merged into main first.${NC}"
    launch_agents $WAVE2_NAMES
    exit 0
    ;;
  --wave3)
    echo "${BOLD}Wave 3: Sweep + Tests (2 agents)${NC}"
    echo "${DIM}Requires wave2 merged into main first.${NC}"
    launch_agents $WAVE3_NAMES
    exit 0
    ;;
  --merge-wave1)
    do_merge $WAVE1_NAMES
    exit $?
    ;;
  --merge-wave2)
    do_merge $WAVE2_NAMES
    exit $?
    ;;
  --merge-wave3)
    do_merge $WAVE3_NAMES
    exit $?
    ;;
  --merge-all)
    do_merge $ALL_NAMES
    exit $?
    ;;
  --status)
    do_status
    exit 0
    ;;
  --clean)
    do_clean
    exit 0
    ;;
  --help|-h)
    echo "${BOLD}🔥 The Fireplace — Phase 18 Overhaul Agent Launcher${NC}"
    echo ""
    echo "Usage:"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --prereqs${NC}       Run Phase 18.0 setup (main branch)"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --wave1${NC}         Launch 18.1/18.2/18.3/18.5 (4 agents)"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --wave2${NC}         Launch 18.4A-D (4 agents)"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --wave3${NC}         Launch 18.6/18.7 (2 agents)"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --merge-wave1${NC}   Merge wave 1 branches"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --merge-wave2${NC}   Merge wave 2 branches"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --merge-wave3${NC}   Merge wave 3 branches"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --merge-all${NC}     Merge all branches"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --status${NC}        Check agent progress"
    echo "  ${BOLD}./scripts/launch-overhaul.sh --clean${NC}         Remove all worktrees"
    echo ""
    echo "Recommended workflow:"
    echo "  1. ${BOLD}--prereqs${NC}       # Install deps, vitest, directories"
    echo "  2. ${DIM}(manually do 18.0B — gateway stability fix)${NC}"
    echo "  3. ${BOLD}--wave1${NC}         # 4 parallel: shadcn, datatable, recharts, utils"
    echo "  4. ${BOLD}--status${NC}        # Wait for completion"
    echo "  5. ${BOLD}--merge-wave1${NC}   # Merge to main"
    echo "  6. ${BOLD}--wave2${NC}         # 4 parallel: chat, cron, agents, sessions decomp"
    echo "  7. ${BOLD}--merge-wave2${NC}   # Merge to main"
    echo "  8. ${BOLD}--wave3${NC}         # 2 parallel: sweep + tests"
    echo "  9. ${BOLD}--merge-wave3${NC}   # Final merge"
    echo " 10. ${BOLD}--clean${NC}         # Remove worktrees"
    echo ""
    exit 0
    ;;
  *)
    echo "${BOLD}${CYAN}🔥 The Fireplace — Phase 18 Overhaul${NC}"
    echo ""
    echo "Run ${BOLD}./scripts/launch-overhaul.sh --help${NC} for usage."
    echo ""
    do_status
    exit 0
    ;;
esac
