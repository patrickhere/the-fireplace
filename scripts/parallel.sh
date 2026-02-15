#!/bin/bash
# The Fireplace — Parallel Claude Code Sessions
# Interactive launcher with automatic merge and cleanup.
#
# Usage:
#   ./scripts/parallel.sh              # Interactive session picker
#   ./scripts/parallel.sh --merge      # Merge all branches back to main
#   ./scripts/parallel.sh --clean      # Remove all worktrees

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")"

# ── Session definitions ──
NAMES=(gateway ui chat dashboards operations polish)

declare -A LABELS
LABELS[gateway]="Gateway       │ WebSocket client, protocol v3, connection store"
LABELS[ui]="UI Shell      │ Sidebar, routing, theme, responsive layout"
LABELS[chat]="Chat          │ Streaming messages, markdown, attachments"
LABELS[dashboards]="Dashboards    │ Sessions, channels, agents views"
LABELS[operations]="Operations    │ Approvals, cron, config, logs, skills, devices"
LABELS[polish]="Polish        │ System tray, Cmd+K, notifications, shortcuts"

declare -A PROMPTS
PROMPTS[gateway]="Use the gateway agent to build the full GatewayClient class in src/gateway/. Use /protocol-check to verify all types against the OpenClaw source before writing them. Implement the complete v3 handshake (challenge → connect → hello-ok), auto-reconnect with exponential backoff, request/response matching by ID with timeouts, event subscription system, idempotency keys, state version tracking, and tick/watchdog. Create the connection Zustand store. Run /dev to verify it compiles. Commit your work when done."

PROMPTS[ui]="Use the ui-shell agent to finalize the app shell. Wire up React Router with all views from PLAN.md. Build the Sidebar component for macOS and MobileNav for iOS using the /design skill for exact colors and patterns. Add the ConnectionStatus indicator. Set up the dark amber theme in Tailwind v4 globals. Make it responsive from the start. Run /dev to verify it launches. Commit your work when done."

PROMPTS[chat]="Use the chat agent to build the complete chat view in src/views/Chat.tsx. Implement streaming message rendering, markdown with syntax-highlighted code blocks (react-markdown + rehype), file/image attachments with drag-and-drop, abort button, session selector, inject assistant notes, and inline session config. Create the chat Zustand store. Use /design for chat bubble styling. Run /dev to verify it compiles. Commit your work when done."

PROMPTS[dashboards]="Use the dashboards agent to build the Sessions, Channels, and Agents views. Sessions: list with search/filter, preview, usage stats, patch config, reset/delete/compact actions. Channels: status board with per-account health, emphasis on WhatsApp + Discord. Agents: list, CRUD, file browser with CodeMirror editor. Create all Zustand stores. Use /design for table and card styling. Run /dev to verify. Commit your work when done."

PROMPTS[operations]="Use the operations agent to build Approvals, Cron, Config, Skills, Devices, and Logs views. Approvals: real-time notifications, approve/reject, deny list management. Cron: job CRUD, execution history. Config: schema-driven form + raw JSON editor. Logs: live tailing with level/source filters in monospace. Create all Zustand stores. Use /design for styling. Run /dev to verify. Commit your work when done."

PROMPTS[polish]="Use the polish agent to add system tray with flame icon (macOS), Cmd+K command palette using shadcn Command component, keyboard shortcuts (Cmd+N, Cmd+1-9, Cmd+Enter, Escape), native notifications via tauri-plugin-notification, and auto-update via tauri-plugin-updater. Use /design for command palette styling. Run /dev to verify. Commit your work when done."

# ── Helper functions ──
do_merge() {
    echo -e "\n${BOLD}Merging branches back to main...${NC}"
    cd "$PROJECT_ROOT" || exit 1
    git checkout main 2>/dev/null

    MERGED=0
    for NAME in "${NAMES[@]}"; do
        BRANCH="feat/$NAME"
        if git rev-parse --verify "$BRANCH" &>/dev/null; then
            echo -e "  ${BLUE}⟳${NC} Merging $BRANCH..."
            if git merge "$BRANCH" --no-edit 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} Merged $BRANCH"
                ((MERGED++))
            else
                echo -e "  ${RED}✗${NC} Merge conflict on $BRANCH"
                echo -e "    Resolve manually, then run: git merge --continue"
                echo -e "    Or abort: git merge --abort"
                return 1
            fi
        fi
    done

    if [ "$MERGED" -eq 0 ]; then
        echo -e "  ${DIM}No branches to merge.${NC}"
    else
        echo -e "\n  ${GREEN}✓ Merged $MERGED branch(es) into main.${NC}"
    fi
}

do_clean() {
    echo -e "\n${BOLD}Cleaning up worktrees...${NC}"
    cd "$PROJECT_ROOT" || exit 1

    CLEANED=0
    for NAME in "${NAMES[@]}"; do
        WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
        if [ -d "$WT_PATH" ]; then
            echo -e "  ${BLUE}⟳${NC} Removing fireplace-$NAME..."
            git worktree remove "$WT_PATH" --force 2>/dev/null
            git branch -D "feat/$NAME" 2>/dev/null
            ((CLEANED++))
        fi
    done

    # Clean up prompt files
    rm -f "$WORKTREE_BASE"/fireplace-*/.claude-prompt.txt 2>/dev/null

    if [ "$CLEANED" -eq 0 ]; then
        echo -e "  ${DIM}Nothing to clean.${NC}"
    else
        echo -e "  ${GREEN}✓ Removed $CLEANED worktree(s).${NC}"
    fi
}

wait_for_sessions() {
    local selected=("$@")
    echo ""
    echo -e "${BOLD}Sessions are running.${NC}"
    echo -e "${DIM}Each session will commit its work when finished.${NC}"
    echo ""
    echo -e "Press ${BOLD}Enter${NC} when all sessions have completed to merge and clean up."
    echo -e "Press ${BOLD}s${NC} to check status, ${BOLD}q${NC} to skip merge/cleanup."
    echo ""

    while true; do
        read -rsn1 KEY
        case "$KEY" in
            "")
                # Enter pressed — merge and clean
                do_merge
                if [ $? -eq 0 ]; then
                    do_clean
                    echo ""
                    echo -e "${GREEN}${BOLD}All done!${NC} Everything merged to main and cleaned up."
                    echo -e "Run ${BOLD}pnpm tauri dev${NC} from the project root to test."
                fi
                return
                ;;
            s|S)
                echo ""
                echo -e "${BOLD}Worktree status:${NC}"
                for NAME in "${selected[@]}"; do
                    WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
                    if [ -d "$WT_PATH" ]; then
                        COMMITS=$(cd "$WT_PATH" && git log main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
                        if [ "$COMMITS" -gt 0 ]; then
                            echo -e "  ${GREEN}✓${NC} $NAME — $COMMITS commit(s)"
                        else
                            echo -e "  ${YELLOW}⟳${NC} $NAME — working (no commits yet)"
                        fi
                    fi
                done
                echo ""
                echo -e "Press ${BOLD}Enter${NC} to merge, ${BOLD}s${NC} for status, ${BOLD}q${NC} to quit."
                ;;
            q|Q)
                echo ""
                echo -e "${YELLOW}Skipped merge/cleanup.${NC}"
                echo -e "  Merge later:  ${BOLD}./scripts/parallel.sh --merge${NC}"
                echo -e "  Clean later:  ${BOLD}./scripts/parallel.sh --clean${NC}"
                return
                ;;
        esac
    done
}

# ── Handle flags ──
if [[ "$1" == "--merge" ]]; then
    do_merge
    exit $?
fi

if [[ "$1" == "--clean" ]]; then
    do_clean
    exit 0
fi

# ── Interactive session picker ──
clear
echo -e "${BOLD}🔥 The Fireplace — Build Sessions${NC}"
echo ""
echo -e "Which sessions do you want to launch?"
echo -e "${DIM}Use numbers to toggle, then Enter to launch.${NC}"
echo ""

# Track selection state (all off by default)
declare -A SELECTED
for NAME in "${NAMES[@]}"; do
    SELECTED[$NAME]=false
done

render_menu() {
    # Move cursor up to redraw
    if [ "$1" == "redraw" ]; then
        tput cuu $(( ${#NAMES[@]} + 2 ))
    fi

    local IDX=1
    for NAME in "${NAMES[@]}"; do
        if ${SELECTED[$NAME]}; then
            echo -e "  ${GREEN}[✓]${NC} ${BOLD}$IDX${NC}  ${LABELS[$NAME]}"
        else
            echo -e "  ${DIM}[ ]${NC} ${BOLD}$IDX${NC}  ${LABELS[$NAME]}"
        fi
        ((IDX++))
    done

    # Count selected
    local COUNT=0
    for NAME in "${NAMES[@]}"; do
        ${SELECTED[$NAME]} && ((COUNT++))
    done

    echo ""
    echo -e "  ${DIM}[a] select all  [n] select none  [Enter] launch $COUNT session(s)  [q] quit${NC}"
}

render_menu

while true; do
    read -rsn1 KEY

    case "$KEY" in
        1) ${SELECTED[gateway]} && SELECTED[gateway]=false || SELECTED[gateway]=true ;;
        2) ${SELECTED[ui]} && SELECTED[ui]=false || SELECTED[ui]=true ;;
        3) ${SELECTED[chat]} && SELECTED[chat]=false || SELECTED[chat]=true ;;
        4) ${SELECTED[dashboards]} && SELECTED[dashboards]=false || SELECTED[dashboards]=true ;;
        5) ${SELECTED[operations]} && SELECTED[operations]=false || SELECTED[operations]=true ;;
        6) ${SELECTED[polish]} && SELECTED[polish]=false || SELECTED[polish]=true ;;
        a|A)
            for NAME in "${NAMES[@]}"; do SELECTED[$NAME]=true; done
            ;;
        n|N)
            for NAME in "${NAMES[@]}"; do SELECTED[$NAME]=false; done
            ;;
        q|Q)
            echo ""
            exit 0
            ;;
        "")
            # Enter — launch selected
            break
            ;;
    esac

    render_menu redraw
done

# Collect selected sessions
LAUNCH=()
for NAME in "${NAMES[@]}"; do
    ${SELECTED[$NAME]} && LAUNCH+=("$NAME")
done

if [ ${#LAUNCH[@]} -eq 0 ]; then
    echo -e "\n${YELLOW}No sessions selected.${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}Launching ${#LAUNCH[@]} session(s): ${LAUNCH[*]}${NC}"
echo ""

# ── Create worktrees ──
cd "$PROJECT_ROOT" || exit 1

for NAME in "${LAUNCH[@]}"; do
    BRANCH="feat/$NAME"
    WT_PATH="$WORKTREE_BASE/fireplace-$NAME"

    if [ ! -d "$WT_PATH" ]; then
        echo -e "  ${BLUE}⟳${NC} Creating worktree: fireplace-$NAME"
        git worktree add "$WT_PATH" -b "$BRANCH" 2>/dev/null || {
            git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || {
                echo -e "  ${RED}✗${NC} Failed to create worktree for $NAME"
                continue
            }
        }
    else
        echo -e "  ${GREEN}✓${NC} Worktree exists: fireplace-$NAME"
    fi

    # Install deps if needed
    if [ ! -d "$WT_PATH/node_modules" ] && [ -f "$WT_PATH/package.json" ]; then
        echo -e "  ${BLUE}⟳${NC} Installing deps in fireplace-$NAME..."
        (cd "$WT_PATH" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null) &
    fi
done

wait
echo ""

# ── Launch Claude Code sessions ──
for NAME in "${LAUNCH[@]}"; do
    WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
    PROMPT="${PROMPTS[$NAME]}"

    if [ ! -d "$WT_PATH" ]; then
        continue
    fi

    echo -e "  ${GREEN}🔥${NC} Launching fireplace-$NAME..."

    # Write prompt to file to avoid escaping issues
    PROMPT_FILE="$WT_PATH/.claude-prompt.txt"
    echo "$PROMPT" > "$PROMPT_FILE"

    # Try Terminal.app first, then iTerm2
    osascript -e "
        tell application \"Terminal\"
            activate
            do script \"cd '$WT_PATH' && claude -p \\\"\$(cat .claude-prompt.txt)\\\"\"
        end tell
    " 2>/dev/null || {
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
            echo -e "  ${YELLOW}⚠${NC} Couldn't open terminal for $NAME"
            echo -e "    Manual: cd $WT_PATH && claude -p \"\$(cat .claude-prompt.txt)\""
        }
    }

    # Small delay between launches to avoid terminal race conditions
    sleep 1
done

# ── Wait, then merge and clean ──
wait_for_sessions "${LAUNCH[@]}"
