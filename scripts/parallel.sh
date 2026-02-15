#!/bin/bash
# The Fireplace — Parallel Claude Code Sessions
# Spins up git worktrees and launches Claude Code in each.
#
# Usage:
#   ./scripts/parallel.sh                    # Launch all phase 1 sessions
#   ./scripts/parallel.sh gateway ui chat    # Launch specific sessions
#   ./scripts/parallel.sh --merge            # Merge all branches back to main
#   ./scripts/parallel.sh --clean            # Remove all worktrees

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")"

# Define sessions: name → branch, prompt
declare -A PROMPTS
PROMPTS[gateway]="Use the gateway agent to build the full GatewayClient class in src/gateway/. Use /protocol-check to verify all types against the OpenClaw source before writing them. Implement the complete v3 handshake (challenge → connect → hello-ok), auto-reconnect with exponential backoff, request/response matching by ID with timeouts, event subscription system, idempotency keys, state version tracking, and tick/watchdog. Create the connection Zustand store. Run /dev to verify it compiles."

PROMPTS[ui]="Use the ui-shell agent to finalize the app shell. Wire up React Router with all views from PLAN.md. Build the Sidebar component for macOS and MobileNav for iOS using the /design skill for exact colors and patterns. Add the ConnectionStatus indicator. Set up the dark amber theme in Tailwind v4 globals. Make it responsive from the start. Run /dev to verify it launches."

PROMPTS[chat]="Use the chat agent to build the complete chat view in src/views/Chat.tsx. Implement streaming message rendering, markdown with syntax-highlighted code blocks (react-markdown + rehype), file/image attachments with drag-and-drop, abort button, session selector, inject assistant notes, and inline session config. Create the chat Zustand store. Use /design for chat bubble styling. Run /dev to verify it compiles."

PROMPTS[dashboards]="Use the dashboards agent to build the Sessions, Channels, and Agents views. Sessions: list with search/filter, preview, usage stats, patch config, reset/delete/compact actions. Channels: status board with per-account health, emphasis on WhatsApp + Discord. Agents: list, CRUD, file browser with CodeMirror editor. Create all Zustand stores. Use /design for table and card styling. Run /dev to verify."

PROMPTS[operations]="Use the operations agent to build Approvals, Cron, Config, Skills, Devices, and Logs views. Approvals: real-time notifications, approve/reject, deny list management. Cron: job CRUD, execution history. Config: schema-driven form + raw JSON editor. Logs: live tailing with level/source filters in monospace. Create all Zustand stores. Use /design for styling. Run /dev to verify."

PROMPTS[polish]="Use the polish agent to add system tray with flame icon (macOS), Cmd+K command palette using shadcn Command component, keyboard shortcuts (Cmd+N, Cmd+1-9, Cmd+Enter, Escape), native notifications via tauri-plugin-notification, and auto-update via tauri-plugin-updater. Use /design for command palette styling. Run /dev to verify."

# ── Merge mode ──
if [[ "$1" == "--merge" ]]; then
    echo -e "${BOLD}Merging worktree branches back to main...${NC}"
    cd "$PROJECT_ROOT" || exit 1
    git checkout main 2>/dev/null

    for NAME in gateway ui chat dashboards operations polish; do
        BRANCH="feat/$NAME"
        if git rev-parse --verify "$BRANCH" &>/dev/null; then
            echo -e "  ${BLUE}⟳${NC} Merging $BRANCH..."
            if git merge "$BRANCH" --no-edit 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} Merged $BRANCH"
            else
                echo -e "  ${RED}✗${NC} Merge conflict on $BRANCH — resolve manually"
                echo -e "    Run: git merge --abort  (to undo)"
                exit 1
            fi
        fi
    done
    echo -e "\n${GREEN}All branches merged.${NC}"
    exit 0
fi

# ── Clean mode ──
if [[ "$1" == "--clean" ]]; then
    echo -e "${BOLD}Removing worktrees...${NC}"
    cd "$PROJECT_ROOT" || exit 1
    for NAME in gateway ui chat dashboards operations polish; do
        WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
        if [ -d "$WT_PATH" ]; then
            echo -e "  ${BLUE}⟳${NC} Removing fireplace-$NAME..."
            git worktree remove "$WT_PATH" --force 2>/dev/null
            git branch -D "feat/$NAME" 2>/dev/null
            echo -e "  ${GREEN}✓${NC} Removed"
        fi
    done
    echo -e "\n${GREEN}Clean.${NC}"
    exit 0
fi

# ── Determine which sessions to launch ──
if [ $# -gt 0 ]; then
    SESSIONS=("$@")
else
    # Default: all sessions — build the whole project
    SESSIONS=(gateway ui chat dashboards operations polish)
fi

echo -e "${BOLD}The Fireplace — Parallel Sessions${NC}"
echo -e "  Launching: ${SESSIONS[*]}"
echo ""

# ── Create worktrees and launch ──
cd "$PROJECT_ROOT" || exit 1

for NAME in "${SESSIONS[@]}"; do
    if [ -z "${PROMPTS[$NAME]}" ]; then
        echo -e "  ${RED}✗${NC} Unknown session: $NAME"
        echo -e "    Available: gateway, ui, chat, dashboards, operations, polish"
        continue
    fi

    BRANCH="feat/$NAME"
    WT_PATH="$WORKTREE_BASE/fireplace-$NAME"

    # Create worktree if it doesn't exist
    if [ ! -d "$WT_PATH" ]; then
        echo -e "  ${BLUE}⟳${NC} Creating worktree: fireplace-$NAME"
        git worktree add "$WT_PATH" -b "$BRANCH" 2>/dev/null || {
            # Branch might already exist
            git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || {
                echo -e "  ${RED}✗${NC} Failed to create worktree for $NAME"
                continue
            }
        }
    else
        echo -e "  ${GREEN}✓${NC} Worktree exists: fireplace-$NAME"
    fi

    # Install deps if needed
    if [ ! -d "$WT_PATH/node_modules" ]; then
        echo -e "  ${BLUE}⟳${NC} Installing deps in fireplace-$NAME..."
        (cd "$WT_PATH" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null) &
    fi
done

# Wait for all installs
wait

echo ""

# Launch Claude Code sessions in new terminal tabs
for NAME in "${SESSIONS[@]}"; do
    WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    PROMPT="${PROMPTS[$NAME]}"

    if [ ! -d "$WT_PATH" ]; then
        continue
    fi

    echo -e "  ${GREEN}🔥${NC} Launching Claude Code in fireplace-$NAME..."

    # Write the prompt to a temp file to avoid shell escaping hell
    PROMPT_FILE="$WT_PATH/.claude-prompt.txt"
    echo "$PROMPT" > "$PROMPT_FILE"

    # Open a new Terminal.app tab and run claude with the prompt
    osascript -e "
        tell application \"Terminal\"
            activate
            do script \"cd '$WT_PATH' && claude -p \\\"\$(cat .claude-prompt.txt)\\\"\"
        end tell
    " 2>/dev/null || {
        # Fallback: try iTerm2
        osascript -e "
            tell application \"iTerm2\"
                tell current window
                    create tab with default profile
                    tell current session
                        write text \"cd '$WT_PATH' && claude -p \\\"\$(cat .claude-prompt.txt)\\\"\"
                    end tell
                end tell
            end tell
        " 2>/dev/null || {
            echo -e "  ${YELLOW}⚠${NC} Couldn't open terminal tab for $NAME"
            echo -e "    Manual: cd $WT_PATH && claude -p \"\$(cat .claude-prompt.txt)\""
        }
    }
done

echo ""
echo -e "${BOLD}Sessions launched.${NC}"
echo -e "  When done: ${BOLD}./scripts/parallel.sh --merge${NC}"
echo -e "  To clean up: ${BOLD}./scripts/parallel.sh --clean${NC}"
