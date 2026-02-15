#!/bin/zsh
# The Fireplace — Parallel Claude Code Sessions
# Interactive launcher with automatic merge and cleanup.
#
# Usage:
#   ./scripts/parallel.sh              # Interactive session picker
#   ./scripts/parallel.sh --phase N    # Launch sessions for a specific phase
#   ./scripts/parallel.sh --merge      # Merge all branches back to main
#   ./scripts/parallel.sh --clean      # Remove all worktrees

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
DIM=$'\033[2m'
NC=$'\033[0m'
BOLD=$'\033[1m'

PROJECT_ROOT="${0:A:h:h}"
WORKTREE_BASE="${PROJECT_ROOT:h}"

# ── Session definitions (indexed arrays, zsh 1-based) ──
NAMES=(gateway ui chat dashboards operations polish)

typeset -A LABELS
LABELS=(
    gateway     "Gateway       │ WebSocket client, protocol v3, connection store"
    ui          "UI Shell      │ Sidebar, routing, theme, responsive layout"
    chat        "Chat          │ Streaming messages, markdown, attachments"
    dashboards  "Dashboards    │ Sessions, channels, agents views"
    operations  "Operations    │ Approvals, cron, config, logs, skills, devices"
    polish      "Polish        │ System tray, Cmd+K, notifications, shortcuts"
)

typeset -A PROMPTS
PROMPTS=(
    gateway "Use the gateway agent to build the full GatewayClient class in src/gateway/. Use /protocol-check to verify all types against the OpenClaw source before writing them. Implement the complete v3 handshake (challenge → connect → hello-ok), auto-reconnect with exponential backoff, request/response matching by ID with timeouts, event subscription system, idempotency keys, state version tracking, and tick/watchdog. Create the connection Zustand store. Run /dev to verify it compiles. Commit your work when done."

    ui "Use the ui-shell agent to finalize the app shell. Wire up React Router with all views from PLAN.md. Build the Sidebar component for macOS and MobileNav for iOS using the /design skill for exact colors and patterns. Add the ConnectionStatus indicator. Set up the dark amber theme in Tailwind v4 globals. Make it responsive from the start. Run /dev to verify it launches. Commit your work when done."

    chat "Use the chat agent to build the complete chat view in src/views/Chat.tsx. Implement streaming message rendering, markdown with syntax-highlighted code blocks (react-markdown + rehype), file/image attachments with drag-and-drop, abort button, session selector, inject assistant notes, and inline session config. Create the chat Zustand store. Use /design for chat bubble styling. Run /dev to verify it compiles. Commit your work when done."

    dashboards "Use the dashboards agent to build the Sessions, Channels, and Agents views. Sessions: list with search/filter, preview, usage stats, patch config, reset/delete/compact actions. Channels: status board with per-account health, emphasis on WhatsApp + Discord. Agents: list, CRUD, file browser with CodeMirror editor. Create all Zustand stores. Use /design for table and card styling. Run /dev to verify. Commit your work when done."

    operations "Use the operations agent to build Approvals, Cron, Config, Skills, Devices, and Logs views. Approvals: real-time notifications, approve/reject, deny list management. Cron: job CRUD, execution history. Config: schema-driven form + raw JSON editor. Logs: live tailing with level/source filters in monospace. Create all Zustand stores. Use /design for styling. Run /dev to verify. Commit your work when done."

    polish "Use the polish agent to add system tray with flame icon (macOS), Cmd+K command palette using shadcn Command component, keyboard shortcuts (Cmd+N, Cmd+1-9, Cmd+Enter, Escape), native notifications via tauri-plugin-notification, and auto-update via tauri-plugin-updater. Use /design for command palette styling. Run /dev to verify. Commit your work when done."
)

# ── Phase presets ──
typeset -A PHASES
PHASES=(
    1 "gateway ui"
    2 "gateway chat"
    3 "dashboards gateway"
    4 "operations dashboards"
    5 "operations gateway"
    6 "operations"
    7 "polish"
)

typeset -A PHASE_NAMES
PHASE_NAMES=(
    1 "Skeleton — scaffold, gateway client, app shell"
    2 "Chat — streaming messages, markdown, attachments"
    3 "Dashboards — sessions, channels, agents"
    4 "Config & Agents — config editor, agent file management"
    5 "Operations — approvals, cron, logs"
    6 "Logs & Usage — log viewer, usage tracking"
    7 "Polish — system tray, Cmd+K, notifications"
)

# ── Helper functions ──
do_merge() {
    echo "\n${BOLD}Merging branches back to main...${NC}"
    cd "$PROJECT_ROOT" || exit 1
    git checkout main 2>/dev/null

    local MERGED=0
    for NAME in $NAMES; do
        local BRANCH="feat/$NAME"
        if git rev-parse --verify "$BRANCH" &>/dev/null; then
            echo "  ${BLUE}⟳${NC} Merging $BRANCH..."
            if git merge "$BRANCH" --no-edit 2>/dev/null; then
                echo "  ${GREEN}✓${NC} Merged $BRANCH"
                ((MERGED++))
            else
                echo "  ${RED}✗${NC} Merge conflict on $BRANCH"
                echo "    Resolve manually, then run: git merge --continue"
                echo "    Or abort: git merge --abort"
                return 1
            fi
        fi
    done

    if [[ "$MERGED" -eq 0 ]]; then
        echo "  ${DIM}No branches to merge.${NC}"
    else
        echo "\n  ${GREEN}✓ Merged $MERGED branch(es) into main.${NC}"
    fi
}

do_clean() {
    echo "\n${BOLD}Cleaning up worktrees...${NC}"
    cd "$PROJECT_ROOT" || exit 1

    local CLEANED=0
    for NAME in $NAMES; do
        local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
        if [[ -d "$WT_PATH" ]]; then
            echo "  ${BLUE}⟳${NC} Removing fireplace-$NAME..."
            git worktree remove "$WT_PATH" --force 2>/dev/null
            git branch -D "feat/$NAME" 2>/dev/null
            ((CLEANED++))
        fi
    done

    rm -f "$WORKTREE_BASE"/fireplace-*/.claude-prompt.txt 2>/dev/null

    if [[ "$CLEANED" -eq 0 ]]; then
        echo "  ${DIM}Nothing to clean.${NC}"
    else
        echo "  ${GREEN}✓ Removed $CLEANED worktree(s).${NC}"
    fi
}

wait_for_sessions() {
    local selected=("$@")
    echo ""
    echo "${BOLD}Sessions are running.${NC}"
    echo "${DIM}Each session will commit its work when finished.${NC}"
    echo ""
    echo "Press ${BOLD}Enter${NC} when all sessions have completed to merge and clean up."
    echo "Press ${BOLD}s${NC} to check status, ${BOLD}q${NC} to skip merge/cleanup."
    echo ""

    while true; do
        read -rsk1 KEY
        case "$KEY" in
            $'\n')
                do_merge
                if [[ $? -eq 0 ]]; then
                    do_clean
                    echo ""
                    echo "${GREEN}${BOLD}All done!${NC} Everything merged to main and cleaned up."
                    echo "Run ${BOLD}pnpm tauri dev${NC} from the project root to test."
                fi
                return
                ;;
            s|S)
                echo ""
                echo "${BOLD}Worktree status:${NC}"
                for NAME in $selected; do
                    local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
                    if [[ -d "$WT_PATH" ]]; then
                        local COMMITS=$(cd "$WT_PATH" && git log main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
                        if [[ "$COMMITS" -gt 0 ]]; then
                            echo "  ${GREEN}✓${NC} $NAME — $COMMITS commit(s)"
                        else
                            echo "  ${YELLOW}⟳${NC} $NAME — working (no commits yet)"
                        fi
                    fi
                done
                echo ""
                echo "Press ${BOLD}Enter${NC} to merge, ${BOLD}s${NC} for status, ${BOLD}q${NC} to quit."
                ;;
            q|Q)
                echo ""
                echo "${YELLOW}Skipped merge/cleanup.${NC}"
                echo "  Merge later:  ${BOLD}./scripts/parallel.sh --merge${NC}"
                echo "  Clean later:  ${BOLD}./scripts/parallel.sh --clean${NC}"
                return
                ;;
        esac
    done
}

launch_sessions() {
    local LAUNCH=("$@")

    echo ""
    echo "${BOLD}Launching ${#LAUNCH[@]} session(s): ${LAUNCH[*]}${NC}"
    echo ""

    cd "$PROJECT_ROOT" || exit 1

    for NAME in $LAUNCH; do
        local BRANCH="feat/$NAME"
        local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"

        if [[ ! -d "$WT_PATH" ]]; then
            echo "  ${BLUE}⟳${NC} Creating worktree: fireplace-$NAME"
            git worktree add "$WT_PATH" -b "$BRANCH" 2>/dev/null || {
                git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || {
                    echo "  ${RED}✗${NC} Failed to create worktree for $NAME"
                    continue
                }
            }
        else
            echo "  ${GREEN}✓${NC} Worktree exists: fireplace-$NAME"
        fi

        if [[ ! -d "$WT_PATH/node_modules" ]] && [[ -f "$WT_PATH/package.json" ]]; then
            echo "  ${BLUE}⟳${NC} Installing deps in fireplace-$NAME..."
            (cd "$WT_PATH" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null) &
        fi
    done

    wait
    echo ""

    for NAME in $LAUNCH; do
        local WT_PATH="$WORKTREE_BASE/fireplace-$NAME"
        local PROMPT="${PROMPTS[$NAME]}"

        [[ ! -d "$WT_PATH" ]] && continue

        echo "  ${GREEN}🔥${NC} Launching fireplace-$NAME..."

        # Write a launcher script to avoid quoting hell through AppleScript
        local LAUNCHER="$WT_PATH/.claude-launch.sh"
        cat > "$LAUNCHER" <<LAUNCHER_EOF
#!/bin/zsh
cd "$WT_PATH"
exec claude "\$(cat .claude-prompt.txt)"
LAUNCHER_EOF
        chmod +x "$LAUNCHER"
        echo "$PROMPT" > "$WT_PATH/.claude-prompt.txt"

        # Launch in iTerm2 (preferred) or Terminal.app
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
        else
            echo "  ${YELLOW}⚠${NC} Couldn't open terminal for $NAME"
            echo "    Run manually: $LAUNCHER"
        fi

        sleep 1
    done

    wait_for_sessions $LAUNCH
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

if [[ "$1" == "--phase" ]]; then
    PHASE="$2"
    if [[ -z "${PHASES[$PHASE]}" ]]; then
        echo "${RED}Unknown phase: $PHASE${NC}"
        echo "Available phases:"
        for P in {1..7}; do
            echo "  ${BOLD}$P${NC}  ${PHASE_NAMES[$P]}"
        done
        exit 1
    fi

    echo "${BOLD}🔥 Phase $PHASE — ${PHASE_NAMES[$PHASE]}${NC}"
    echo "  Sessions: ${PHASES[$PHASE]}"

    launch_sessions ${=PHASES[$PHASE]}
    exit 0
fi

# ── Interactive session picker ──
clear
echo "${BOLD}🔥 The Fireplace — Build Sessions${NC}"
echo ""

# Show phase presets
echo "${BOLD}Phase presets:${NC}"
for P in {1..7}; do
    echo "  ${DIM}--phase $P${NC}  ${PHASE_NAMES[$P]}  ${DIM}(${PHASES[$P]})${NC}"
done
echo ""

echo "Or pick individual sessions:"
echo "${DIM}Use numbers to toggle, then Enter to launch.${NC}"
echo ""

# Track selection (0=off, 1=on)
typeset -A SELECTED
for NAME in $NAMES; do
    SELECTED[$NAME]=0
done

render_menu() {
    if [[ "$1" == "redraw" ]]; then
        # Move cursor up
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
    echo "  ${DIM}[a] select all  [n] select none  [Enter] launch $COUNT session(s)  [q] quit${NC}"
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
        1) toggle gateway ;;
        2) toggle ui ;;
        3) toggle chat ;;
        4) toggle dashboards ;;
        5) toggle operations ;;
        6) toggle polish ;;
        a|A) for NAME in $NAMES; do SELECTED[$NAME]=1; done ;;
        n|N) for NAME in $NAMES; do SELECTED[$NAME]=0; done ;;
        q|Q) echo ""; exit 0 ;;
        $'\n')
            # Enter — launch selected
            break
            ;;
    esac

    render_menu redraw
done

# Collect selected
LAUNCH=()
for NAME in $NAMES; do
    [[ "${SELECTED[$NAME]}" -eq 1 ]] && LAUNCH+=($NAME)
done

if [[ ${#LAUNCH[@]} -eq 0 ]]; then
    echo "\n${YELLOW}No sessions selected.${NC}"
    exit 0
fi

launch_sessions $LAUNCH
