#!/bin/zsh
# =============================================================================
# The Fireplace — Phase 9-12 Parallel Agent Launcher
# =============================================================================
# Launches 6 Claude Code agents in parallel, each on its own git branch,
# to implement the demon architecture UI enhancements.
#
# Run from the project root ON the Mac Mini (or wherever the repo lives):
#   ./scripts/launch-demons.sh              # Interactive picker
#   ./scripts/launch-demons.sh --all        # Launch all 6 agents
#   ./scripts/launch-demons.sh --merge      # Merge all branches to main
#   ./scripts/launch-demons.sh --clean      # Remove all worktrees
#   ./scripts/launch-demons.sh --status     # Check progress
#
# Prerequisites:
#   - Phase 8 complete (run ./scripts/setup-mac-mini.sh first)
#   - claude CLI installed and authenticated
#   - pnpm installed
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

# ── Agent definitions ──
NAMES=(agents-templates usage-config models-cron-chat chatroom-replay health-kanban approvals-wiring)

typeset -A LABELS
LABELS=(
  agents-templates  "Agent 1  │ Agents view + Demon Templates"
  usage-config      "Agent 2  │ Usage view + Config view"
  models-cron-chat  "Agent 3  │ Models + Cron + Chat views"
  chatroom-replay   "Agent 4  │ Demon Chat Room + Session Replay"
  health-kanban     "Agent 5  │ Demon Health + Task Kanban"
  approvals-wiring  "Agent 6  │ CLI Approvals + Route Wiring"
)

# ── Agent prompts ──
typeset -A PROMPTS
PROMPTS=(
  agents-templates 'Read .claude/CLAUDE.md and PLAN.md (phases 9A and 11B) first. Follow all project conventions. Do not create any test files.

You are enhancing the Agents view and adding demon templates.

YOUR FILES (only touch these):
- src/stores/agents.ts — extend the Agent interface to include a `model` field (object with `primary: string` and `fallbacks: string[]`). The gateway already returns this on agents.list responses. Parse it from the response data in loadAgents.
- src/views/Agents.tsx — add a model assignment badge on each agent list item. Color-code using the classifyModel() helper from src/lib/modelTiers.ts and its tierBadgeClasses() function. Import and use it instead of hardcoding tier logic. Tiers: free (emerald) for copilot-free/* and google/*, cheap (sky) for copilot-cheap/*, premium (amber) for copilot-premium/*, max (violet) for anthropic/*. Show the primary model name in a small text-xs badge below the agent name. Show the fallback chain in a tooltip or expandable section. When an agent is selected, add a "Role" section in the detail panel that displays the first ~5 lines of the agent'\''s soul.md file content (already available via the file browser — check if the selected file is soul.md).
- src/lib/demonTemplates.ts — NEW FILE. Export a `DEMON_TEMPLATES` array of template objects. Each template has: id (string), name (string), emoji (string), description (string), soulFile (full markdown string for soul.md), suggestedModel ({ primary: string, fallbacks: string[] }), cliPreferences ({ preferred: "claude-code" | "codex" | "either", guidance: string }). Include 10 templates: Orchestrator, Code Architect, Researcher, Strategist, Builder, Security Analyst, Data Engineer, DevOps, QA/Tester, Blank. Write real soul file content for each (at least 10-15 lines of markdown with role, specialties, execution backend preferences, communication style).
- src/views/Agents.tsx — enhance the CreateAgentModal to add a template picker as the first step. Show a grid of template cards (2-col on mobile, 3-col on desktop). Each card shows emoji, name, description. Selecting one pre-fills the name, emoji fields and stores the template so the soul file is written after agent creation. Add a "Blank" option that skips to the existing form. After agent creation, if a template was selected, automatically write the soul file via agents.files.set.

DO NOT touch any other files. Another agent handles routing/nav.

Design: dark theme only, zinc-900/zinc-800 backgrounds, amber-500 accents. Dense padding (p-2/p-3). Use existing shadcn/ui Button and Input components from src/components/ui/. Model badges should be inline, small (text-xs), with rounded-full px-2 py-0.5 styling.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes with a descriptive message.'

  usage-config 'Read .claude/CLAUDE.md and PLAN.md (phases 9B and 9C) first. Follow all project conventions. Do not create any test files.

You are enhancing the Usage and Config views for multi-provider demon visibility.

YOUR FILES (only touch these):
- src/stores/usage.ts — add a `demonUsage` state field (array) and `loadDemonUsage()` action. This groups the existing sessionUsage entries by their agentId field (sessions already have agentId from the gateway). Return an array of { demonId: string, demonName: string, totalTokens: number, inputTokens: number, outputTokens: number, model: string, sessionCount: number }. Also add a `modelDistribution` computed/derived state that groups sessions by model provider prefix: Use the classifyModel() helper from src/lib/modelTiers.ts to determine tiers. Group by tier label: "MAX Sub" for anthropic/*, "Free" for copilot-free/* and google/*, "Low Cost" for copilot-cheap/*, "Premium" for copilot-premium/*, "Other" for everything else. Return { tier: string, tokenCount: number, percentage: number }[].
- src/views/Usage.tsx — add two new sections above the existing session table: (1) "Model Distribution" — a horizontal stacked bar (div-based, no chart library) showing % by provider tier. Use emerald-500 for free tiers, amber-500 for MAX. Show a "X% of requests at $0 cost" summary label. (2) "Per-Demon Usage" — a responsive grid of small cards (2-col mobile, 4-col desktop), one per demon that has usage, showing emoji + name + total tokens (formatted with commas) + model badge (same color coding as above). Sort by totalTokens descending.
- src/stores/config.ts — add a `parsedProviders` getter function that parses the rawConfig JSON string to extract the models.providers object. Return an array of { name: string, baseUrl: string, api: string, modelCount: number }. Handle the case where rawConfig is empty or malformed gracefully. Also add a `testEndpoint(providerName: string)` async action — this should attempt a lightweight request through the connection store to verify the provider endpoint responds (you can call models.list or similar and check for errors).
- src/views/Config.tsx — add a "Model Providers" collapsible section above the existing raw JSON editor. Show each provider as a row with: name (bold), baseUrl (monospace, text-xs), API type badge, model count, status dot (emerald-500 initially, update after test), "Test" button that calls testEndpoint and shows result. Below that, add a "Model Routing" section with a table: columns are Demon (emoji+name), Primary Model, Fallbacks (comma-separated), Provider, Cost Tier (Free/MAX badge). Populate from agents store (model field) cross-referenced with parsedProviders.

DO NOT touch any other files.

Design: dark theme, zinc-900/zinc-800 backgrounds, amber-500 accents. Dense padding (p-2/p-3). Status dots: emerald-500=healthy, red-500=error, zinc-500=unknown. Stacked bar should be h-3 rounded-full with colored segments.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes.'

  models-cron-chat 'Read .claude/CLAUDE.md and PLAN.md (phases 9D, 9E, 9F — the sections labeled D, E, F under Phase 9) first. Follow all project conventions. Do not create any test files.

You are enhancing three existing views: Models, Cron, and Chat.

YOUR FILES (only touch these):
- src/views/Models.tsx — enhance the existing model list. Group models by provider (use the provider field on ModelChoice). For each model, use the classifyModel() and tierBadgeClasses() helpers from src/lib/modelTiers.ts to render cost tier badges. Models from copilot-free/* and google/* show "Free" in emerald, copilot-cheap/* shows "Low Cost" in sky, copilot-premium/* shows "Premium" in amber, anthropic/* shows "MAX" in violet. Add an "Assigned Demons" column/section showing emoji badges of demons that use this model as their primary (cross-reference the agents store — read agent.model.primary).
- src/views/Cron.tsx — when a cron job has an agentId set, look up the matching agent from the agents store and display its emoji + name next to the job name in the job list. Add a "Demon Tasks" toggle filter button at the top of the job list that, when active, only shows jobs that have an agentId. Add a "Quick Create" dropdown button with 4 preset templates: "System Audit" (agentId: buer, schedule: every 6h, payload.kind: agentTurn, message: "Run a system audit"), "Context Cleanup" (agentId: alloces, every 4h), "Security Scan" (agentId: andromalius, cron: 0 3 * * *), "Knowledge Sync" (agentId: paimon, cron: 0 9 * * *). Selecting a template pre-fills the add-job form fields.
- src/views/Chat.tsx — add a "Bulk Upload" button next to the existing attachment button in the input area. It should open a file picker with multiple selection enabled. Selected files are added as attachments (use the existing addAttachment action for each). Show a count badge on the attachment area when multiple files are queued.
- src/stores/chat.ts — add an `addMultipleAttachments(files: File[])` action that reads each file and calls the existing attachment logic for each one.

DO NOT touch any other files.

Design: dark theme, zinc-900/zinc-800 backgrounds, amber-500 accents. Dense padding. Free tier badges: emerald-500 bg-emerald-500/10 text-emerald-500 text-xs rounded-full px-2 py-0.5. Demon emoji badges in Models view should be small inline spans.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes.'

  chatroom-replay 'Read .claude/CLAUDE.md and PLAN.md (phases 10A and 11A) first. Follow all project conventions. Do not create any test files.

You are building two new features: the Demon Chat Room and Session Replay.

YOUR FILES (only touch these):
- src/stores/demonChat.ts — NEW FILE. Create a Zustand store. State: messages (DemonChatMessage[]), activeDemonFilters (Set<string>), isListening (boolean). DemonChatMessage type: { id: string, demonId: string, demonName: string, demonEmoji: string, sessionKey: string, role: "user" | "assistant" | "system", content: string, model: string, timestamp: number, isDelegation: boolean, targetDemonId?: string }. Actions: startListening() — use the connection store'\''s subscribe() method to listen to "chat" events, match each event'\''s agentId against the agents store to get demon identity, append to messages array. Cap at 500 messages (drop oldest). stopListening() — unsubscribe. toggleDemonFilter(demonId) — toggle filter set. injectMessage(demonId, message) — find the demon'\''s active session and send via chat.send. getFilteredMessages() — return messages filtered by activeDemonFilters (show all if empty set).
- src/views/DemonChatRoom.tsx — NEW FILE. Full-page view. Top bar: title "Demon Chat Room", demon filter toggles (emoji buttons, active=amber border, inactive=zinc border), message count. Main area: scrollable message feed, auto-scroll to bottom. Each message: left-border colored per demon (use stable hash of demonId to index into [amber-500, emerald-500, sky-500, violet-500, rose-500, orange-500, teal-500]), demon emoji + name label, message content rendered with MarkdownRenderer from src/components/MarkdownRenderer.tsx, model badge (text-xs), relative timestamp. Delegation messages (isDelegation=true) get special "→ targetDemon" arrow rendering. Bottom: inject bar with demon selector dropdown (emoji + name options) and text input with Cmd+Enter to send. Use useEffect to call startListening on mount, stopListening on unmount.
- src/components/SessionReplay.tsx — NEW FILE. Modal overlay component. Props: { sessionKey: string, startFromMessageId?: string, onClose: () => void }. On mount, load full session history via chat.history (from connection store request). State: messages[], currentIndex (number), isPlaying (boolean), playbackSpeed (1|2|5|10). Playback controls bar: step-back button, play/pause toggle, step-forward button, speed selector buttons, timeline scrubber (input type=range). Display area: show messages[0..currentIndex] rendered like chat bubbles. When playing, advance currentIndex on a timer (1000ms / playbackSpeed). Running token counter at bottom: sum of tokenCount for displayed messages. "Follow delegation" button: when a message content mentions delegating to another demon name, show a button that calls onClose and opens replay for that session (pass this via a callback prop).

DO NOT touch routing or nav files — another agent handles that. Export your components as named exports.

Design: dark theme, zinc-900 background for chat room, zinc-950 for replay overlay with backdrop blur. Message feed: gap-1 between messages, p-2 padding per message. Demon left-border: border-l-2. Replay overlay: fixed inset-0 with z-50, centered max-w-2xl container.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes.'

  health-kanban 'Read .claude/CLAUDE.md and PLAN.md (phases 10C and 10D) first. Follow all project conventions. Do not create any test files.

You are building the Demon Health Dashboard and Task Kanban.

YOUR FILES (only touch these):
- src/stores/demonHealth.ts — NEW FILE. Create a Zustand store. State: demons (DemonStatus[]), isMonitoring (boolean). DemonStatus type: { demonId: string, demonName: string, demonEmoji: string, state: "idle" | "working" | "error" | "offline", currentTask: string | null, activeModel: string, activeSessions: number, lastActivity: number, uptime: number, cliBackend: { active: boolean, tool: "claude-code" | "codex" | null, startedAt: number | null } }. Actions: startMonitoring() — subscribe to "chat" and "exec.approval" events via connection store. On chat events, match agentId to update demon state: receiving delta events = "working", no events for 5 min = "idle". On exec events where command starts with "claude" or "codex", update cliBackend. refreshAll() — call sessions.list, filter by agentId for each known demon, update activeSessions and lastActivity. stopMonitoring(). Initialize demons array from agents store on first call.
- src/views/DemonHealth.tsx — NEW FILE. Full-page view. Header: "Demon Health" title, summary ("5 active · 1 idle · 1 working"), refresh button. Main: responsive grid of cards (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4, gap-3). Each DemonCard: zinc-800 rounded-lg p-3 border border-zinc-700. Top: emoji + name + status dot (emerald-500=working, zinc-400=idle, red-500=error, zinc-700=offline). Middle: currentTask text (line-clamp-2, text-sm text-zinc-400) or em dash if idle. Bottom row: model badge (text-xs), session count, relative lastActivity timestamp. If cliBackend.active: show "Claude Code (Xm)" or "Codex (Xm)" with a small animated pulse dot. Use useEffect to call startMonitoring on mount, stopMonitoring on unmount. Call refreshAll every 30 seconds.
- src/stores/demonTasks.ts — NEW FILE. Create a Zustand store. State: tasks (DemonTask[]), filterDemon (string | null), isTracking (boolean). DemonTask type: { id: string, description: string, status: "queued" | "in_progress" | "done" | "failed", assignedTo: string, assignedToEmoji: string, assignedToName: string, delegatedBy: string, delegatedByEmoji: string, delegatedByName: string, sessionKey: string, model: string, cliBackend: "claude-code" | "codex" | null, createdAt: number, startedAt: number | null, completedAt: number | null, error: string | null }. Actions: startTracking() — subscribe to chat events, detect delegation patterns (a message from one demon'\''s session mentioning another demon = new task). When target demon starts responding = in_progress. When done event fires = done. stopTracking(). setFilter(demonId | null). getFilteredTasks() — filter by filterDemon. Limit to 100 tasks, archive older.
- src/views/DemonKanban.tsx — NEW FILE. Full-page view. Header: "Task Pipeline", filter dropdown by demon, summary counts. Main: 3-column layout (flex on desktop, vertical stack on mobile). Each column: "QUEUED (N)" / "IN PROGRESS (N)" / "DONE (N)" header with zinc-700 border-b. Column body: stack of task cards. Each TaskCard: zinc-800 rounded-lg p-3 border border-zinc-700. Shows: description (line-clamp-2), "→ emoji name" assigned demon, "by emoji name" delegator, model badge, time elapsed. Failed tasks: border-red-500/50, show error text. Done tasks older than 1h: opacity-50. Use useEffect to call startTracking on mount, stopTracking on unmount.

DO NOT touch routing or nav files — another agent handles that. Export your components as named exports.

Design: dark theme, zinc-900 background. Cards: zinc-800 bg, border-zinc-700, rounded-lg, p-3. Status dots: w-2 h-2 rounded-full inline-block. Kanban columns: min-w-[280px] flex-1. Use gap-2 between cards.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes.'

  approvals-wiring 'Read .claude/CLAUDE.md and PLAN.md (phases 10B and 12) first. Follow all project conventions. Do not create any test files.

You are enhancing the Approvals view for CLI backends and wiring up all new routes and navigation.

IMPORTANT: This agent runs LAST. Other agents create these files first:
- src/views/DemonChatRoom.tsx (by Agent 4)
- src/views/DemonHealth.tsx (by Agent 5)
- src/views/DemonKanban.tsx (by Agent 5)
- src/components/SessionReplay.tsx (by Agent 4)

If any of those files do not exist yet, create a minimal placeholder:
  export function ComponentName() { return <div className="p-4 text-zinc-500">Loading...</div>; }
You will replace these with the real imports once the files exist.

YOUR FILES (only touch these):
- src/views/Approvals.tsx — add a "CLI Backends" section at the TOP of the view, before the existing pending approvals. Show active CLI processes: filter pending exec approval requests where the command starts with "claude " or "codex ". For each, show a card: demon emoji+name (look up agentId in agents store), backend name ("Claude Code" or "Codex"), the command being run (truncated), elapsed time since request. Add two quick-approve buttons: "Allow claude --print *" and "Allow codex --print *" that add these narrow read-only patterns to the allowlist. Do NOT use broad "claude *" or "codex *" wildcards — those allow arbitrary execution.
- src/App.tsx — add 3 new routes: /demon-chat renders DemonChatRoom, /demon-health renders DemonHealth, /demon-tasks renders DemonKanban. Import from the respective view files. Follow the existing route pattern in the file.
- src/components/Sidebar.tsx — add a "Demons" section in the sidebar navigation, placed after the existing "Agents" link. Add 3 nav items: "Chat Room" (link to /demon-chat), "Health" (link to /demon-health), "Tasks" (link to /demon-tasks). Use a collapsible group or just a label "DEMONS" in text-xs text-zinc-600 uppercase tracking-wider mb-1 as a section header. Use the same nav item pattern (active state = amber text, inactive = zinc-400).
- src/components/MobileNav.tsx — the bottom nav has limited space. Add "Demons" to the More menu/page (src/views/More.tsx if it exists) as 3 links: Chat Room, Health, Tasks. Or if there is room, replace a less-used tab.
- src/views/Sessions.tsx — add a small "Replay" button (a play triangle icon or "▶" text) to each session row'\''s action buttons. Clicking it opens the SessionReplay component as a modal. Add state: replaySessionKey (string | null). When set, render <SessionReplay sessionKey={replaySessionKey} onClose={() => setReplaySessionKey(null)} />.
- src/views/More.tsx — if this file exists, add 3 new links for the demon views (Chat Room, Health, Tasks) in a "Demons" section.

Design: Sidebar "Demons" section header: text-xs text-zinc-600 uppercase tracking-wider font-medium mt-4 mb-1 px-3. Nav items follow existing pattern exactly. CLI backend cards in Approvals: zinc-800 bg, border-zinc-700, p-3, with amber-500 accent for the backend name.

When done, run `pnpm format` and `pnpm build` to verify no errors. Commit your changes.'
)

# ── Helper functions ──
ok()   { echo "  ${GREEN}✓${NC} $1"; }
warn() { echo "  ${YELLOW}!${NC} $1"; }
fail() { echo "  ${RED}✗${NC} $1"; }

do_status() {
  echo ""
  echo "${BOLD}Agent Status:${NC}"
  echo ""
  for NAME in $NAMES; do
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
  echo ""
  echo "${BOLD}Merging agent branches into main...${NC}"
  echo ""
  cd "$PROJECT_ROOT" || exit 1
  git checkout main 2>/dev/null

  local MERGED=0
  local FAILED=0

  for NAME in $NAMES; do
    local BRANCH="demons/$NAME"
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
  for NAME in $NAMES; do
    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    if [[ -d "$WT_PATH" ]]; then
      echo "  ${BLUE}⟳${NC} Removing fireplace-$NAME..."
      git worktree remove "$WT_PATH" --force 2>/dev/null
      git branch -D "demons/$NAME" 2>/dev/null
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
  echo "${BOLD}${CYAN}🔥 Launching ${#LAUNCH[@]} demon architect(s)...${NC}"
  echo ""

  cd "$PROJECT_ROOT" || exit 1

  # Create worktrees and install deps
  for NAME in $LAUNCH; do
    local BRANCH="demons/$NAME"
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

  # Launch Claude Code sessions
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
echo "🔥 Agent: $NAME"
echo "   Branch: demons/$NAME"
echo "   Worktree: $WT_PATH"
echo ""
exec claude "\$(cat .claude-prompt.txt)"
LAUNCHER_EOF
    chmod +x "$LAUNCHER"

    echo "  ${GREEN}🔥${NC} Launching ${BOLD}$NAME${NC}..."

    # Try iTerm2, then Terminal.app, then tmux, then background
    if osascript <<APPLE_EOF 2>/dev/null; then
tell application "iTerm2"
    activate
    if (count of windows) = 0 then
        create window with default profile
        tell current session of current window
            write text "'${LAUNCHER}'"
        end tell
    else
        tell current window
            create tab with default profile
            tell current session
                write text "'${LAUNCHER}'"
            end tell
        end tell
    end if
end tell
APPLE_EOF
      true
    elif osascript -e "tell application \"Terminal\" to do script \"'${LAUNCHER}'\"" 2>/dev/null; then
      true
    elif command -v tmux &>/dev/null; then
      # SSH-friendly: use tmux
      if ! tmux has-session -t fireplace 2>/dev/null; then
        tmux new-session -d -s fireplace -n "$NAME" "$LAUNCHER"
      else
        tmux new-window -t fireplace -n "$NAME" "$LAUNCHER"
      fi
      ok "Started in tmux (session: fireplace, window: $NAME)"
    else
      # Last resort: background with nohup
      nohup "$LAUNCHER" > "$WT_PATH/.claude-output.log" 2>&1 &
      ok "Started in background (log: $WT_PATH/.claude-output.log)"
    fi

    sleep 1
  done

  echo ""
  echo "${BOLD}All agents launched!${NC}"
  echo ""

  if command -v tmux &>/dev/null && tmux has-session -t fireplace 2>/dev/null; then
    echo "  ${CYAN}tmux detected.${NC} Attach with: ${BOLD}tmux attach -t fireplace${NC}"
    echo "  Switch windows: ${BOLD}Ctrl+B, N${NC} (next) or ${BOLD}Ctrl+B, P${NC} (previous)"
    echo ""
  fi

  echo "  Check status:  ${BOLD}./scripts/launch-demons.sh --status${NC}"
  echo "  Merge all:     ${BOLD}./scripts/launch-demons.sh --merge${NC}"
  echo "  Clean up:      ${BOLD}./scripts/launch-demons.sh --clean${NC}"
  echo ""
}

# ── Handle flags ──
case "${1:-}" in
  --status)
    do_status
    exit 0
    ;;
  --merge)
    do_merge
    exit $?
    ;;
  --clean)
    do_clean
    exit 0
    ;;
  --all)
    launch_agents $NAMES
    exit 0
    ;;
  --first5)
    echo "${BOLD}Launching Agents 1-5 (Agent 6 runs after merge)${NC}"
    launch_agents agents-templates usage-config models-cron-chat chatroom-replay health-kanban
    exit 0
    ;;
  --agent6)
    echo "${BOLD}Launching Agent 6 (wiring + approvals)${NC}"
    launch_agents approvals-wiring
    exit 0
    ;;
  --help|-h)
    echo "${BOLD}🔥 The Fireplace — Demon Architecture Agent Launcher${NC}"
    echo ""
    echo "Usage:"
    echo "  ${BOLD}./scripts/launch-demons.sh${NC}              Interactive picker"
    echo "  ${BOLD}./scripts/launch-demons.sh --all${NC}        Launch all 6 agents"
    echo "  ${BOLD}./scripts/launch-demons.sh --first5${NC}     Launch Agents 1-5 (parallel)"
    echo "  ${BOLD}./scripts/launch-demons.sh --agent6${NC}     Launch Agent 6 (after merge)"
    echo "  ${BOLD}./scripts/launch-demons.sh --status${NC}     Check agent progress"
    echo "  ${BOLD}./scripts/launch-demons.sh --merge${NC}      Merge all branches to main"
    echo "  ${BOLD}./scripts/launch-demons.sh --clean${NC}      Remove all worktrees"
    echo ""
    echo "Recommended workflow:"
    echo "  1. ${BOLD}./scripts/launch-demons.sh --first5${NC}   # Launch Agents 1-5"
    echo "  2. ${BOLD}./scripts/launch-demons.sh --status${NC}   # Wait for completion"
    echo "  3. ${BOLD}./scripts/launch-demons.sh --merge${NC}    # Merge to main"
    echo "  4. ${BOLD}./scripts/launch-demons.sh --agent6${NC}   # Launch Agent 6 (wiring)"
    echo "  5. ${BOLD}./scripts/launch-demons.sh --merge${NC}    # Final merge"
    echo "  6. ${BOLD}./scripts/launch-demons.sh --clean${NC}    # Cleanup"
    exit 0
    ;;
esac

# ── Interactive picker ──
clear
echo "${BOLD}${CYAN}🔥 The Fireplace — Demon Architecture Agents${NC}"
echo ""
echo "${DIM}Phase 9-12: Enhance UI for demon visibility, model routing, and mission control.${NC}"
echo ""
echo "${BOLD}Recommended workflow:${NC}"
echo "  ${DIM}1. Launch Agents 1-5 in parallel (--first5)${NC}"
echo "  ${DIM}2. Wait for completion, merge${NC}"
echo "  ${DIM}3. Launch Agent 6 to wire everything together (--agent6)${NC}"
echo ""
echo "${BOLD}Available agents:${NC}"
echo ""

typeset -A SELECTED
for NAME in $NAMES; do
  SELECTED[$NAME]=0
done

render_menu() {
  if [[ "${1:-}" == "redraw" ]]; then
    printf '\033[%dA' $(( ${#NAMES[@]} + 2 ))
  fi

  local IDX=1
  for NAME in $NAMES; do
    if [[ "${SELECTED[$NAME]}" -eq 1 ]]; then
      echo "  ${GREEN}[✓]${NC} ${BOLD}$IDX${NC}  ${LABELS[$NAME]}"
    else
      echo "  ${DIM}[ ]${NC} ${BOLD}$IDX${NC}  ${LABELS[$NAME]}"
    fi
    ((IDX++))
  done

  local COUNT=0
  for NAME in $NAMES; do
    [[ "${SELECTED[$NAME]}" -eq 1 ]] && ((COUNT++))
  done

  echo ""
  echo "  ${DIM}[a] all  [f] first 5  [n] none  [Enter] launch $COUNT  [q] quit${NC}"
}

toggle() {
  local NAME=$1
  if [[ "${SELECTED[$NAME]}" -eq 1 ]]; then
    SELECTED[$NAME]=0
  else
    SELECTED[$NAME]=1
  fi
}

render_menu

while true; do
  read -rsk1 KEY

  case "$KEY" in
    1) toggle agents-templates ;;
    2) toggle usage-config ;;
    3) toggle models-cron-chat ;;
    4) toggle chatroom-replay ;;
    5) toggle health-kanban ;;
    6) toggle approvals-wiring ;;
    a|A) for NAME in $NAMES; do SELECTED[$NAME]=1; done ;;
    f|F) for NAME in agents-templates usage-config models-cron-chat chatroom-replay health-kanban; do SELECTED[$NAME]=1; done; SELECTED[approvals-wiring]=0 ;;
    n|N) for NAME in $NAMES; do SELECTED[$NAME]=0; done ;;
    q|Q) echo ""; exit 0 ;;
    $'\n') break ;;
  esac

  render_menu redraw
done

# Collect selected
LAUNCH=()
for NAME in $NAMES; do
  [[ "${SELECTED[$NAME]}" -eq 1 ]] && LAUNCH+=($NAME)
done

if [[ ${#LAUNCH[@]} -eq 0 ]]; then
  echo ""
  echo "${YELLOW}No agents selected.${NC}"
  exit 0
fi

launch_agents $LAUNCH
