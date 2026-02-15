#!/bin/bash
# The Fireplace — Dependency Doctor
# Checks and auto-installs everything needed to develop the app.
# Usage:
#   ./scripts/doctor.sh          # Check only
#   ./scripts/doctor.sh --fix    # Auto-install missing dependencies

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

FIX=false
[[ "$1" == "--fix" ]] && FIX=true

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${BLUE}→${NC} $1"; }
header() { echo -e "\n${BOLD}$1${NC}"; }

fixing() {
    echo -e "  ${BLUE}⟳${NC} Installing $1..."
}

ERRORS=0
WARNINGS=0
FIXED=0

header "The Fireplace — Dependency Doctor"
if $FIX; then
    echo -e "  Mode: ${BLUE}auto-fix${NC}"
else
    echo -e "  Mode: check only (use ${BOLD}--fix${NC} to auto-install)"
fi

# ── Xcode Command Line Tools ──
header "Xcode"
if xcode-select -p &>/dev/null; then
    pass "Xcode Command Line Tools installed"
else
    if $FIX; then
        fixing "Xcode Command Line Tools"
        xcode-select --install 2>/dev/null || true
        echo "    ⏳ Xcode CLT installer launched — wait for it to finish, then re-run this script."
        exit 1
    else
        fail "Xcode Command Line Tools missing"
        info "Run: xcode-select --install"
        ((ERRORS++))
    fi
fi

# ── Homebrew ──
header "Homebrew"
if command -v brew &>/dev/null; then
    pass "Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
    if $FIX; then
        fixing "Homebrew"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
        ((FIXED++))
    else
        fail "Homebrew not installed"
        info "Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        ((ERRORS++))
    fi
fi

# ── Rust ──
header "Rust"
if command -v rustc &>/dev/null; then
    RUST_VER=$(rustc --version | awk '{print $2}')
    pass "rustc $RUST_VER"
else
    if $FIX; then
        fixing "Rust"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        ((FIXED++))
    else
        fail "Rust not installed"
        info "Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        ((ERRORS++))
    fi
fi

if command -v cargo &>/dev/null; then
    pass "cargo $(cargo --version | awk '{print $2}')"
elif ! $FIX; then
    fail "cargo not found"
    ((ERRORS++))
fi

# Check for iOS/macOS Rust targets
if command -v rustup &>/dev/null; then
    for TARGET in "aarch64-apple-darwin:macOS ARM" "aarch64-apple-ios:iOS" "aarch64-apple-ios-sim:iOS simulator"; do
        TRIPLE="${TARGET%%:*}"
        LABEL="${TARGET##*:}"
        if rustup target list --installed | grep -q "$TRIPLE"; then
            pass "Rust target: $TRIPLE ($LABEL)"
        else
            if $FIX; then
                fixing "Rust target $TRIPLE"
                rustup target add "$TRIPLE"
                ((FIXED++))
            else
                warn "Missing Rust target: $TRIPLE ($LABEL)"
                info "Run: rustup target add $TRIPLE"
                ((WARNINGS++))
            fi
        fi
    done
fi

# ── Node.js ──
header "Node.js"
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        pass "Node.js $NODE_VER"
    else
        warn "Node.js $NODE_VER (recommend v20+)"
        ((WARNINGS++))
    fi
else
    if $FIX && command -v brew &>/dev/null; then
        fixing "Node.js"
        brew install node
        ((FIXED++))
    else
        fail "Node.js not installed"
        info "Run: brew install node"
        ((ERRORS++))
    fi
fi

# ── pnpm ──
if command -v pnpm &>/dev/null; then
    pass "pnpm $(pnpm --version)"
else
    if $FIX && command -v npm &>/dev/null; then
        fixing "pnpm"
        npm install -g pnpm
        ((FIXED++))
    else
        fail "pnpm not installed"
        info "Run: npm install -g pnpm"
        ((ERRORS++))
    fi
fi

# ── Tauri CLI ──
header "Tauri"
TAURI_FOUND=false
if command -v pnpm &>/dev/null && pnpm list -g @tauri-apps/cli 2>/dev/null | grep -q "@tauri-apps/cli"; then
    pass "Tauri CLI (global pnpm)"
    TAURI_FOUND=true
elif command -v cargo &>/dev/null && cargo install --list 2>/dev/null | grep -q "tauri-cli"; then
    pass "Tauri CLI (cargo)"
    TAURI_FOUND=true
fi

if ! $TAURI_FOUND; then
    if $FIX && command -v pnpm &>/dev/null; then
        fixing "Tauri CLI"
        pnpm add -g @tauri-apps/cli
        ((FIXED++))
    else
        warn "Tauri CLI not found globally (will use project-local via pnpm)"
        info "Run: pnpm add -g @tauri-apps/cli"
        ((WARNINGS++))
    fi
fi

# ── Tailscale ──
header "Network"
# Tailscale CLI can be at /usr/local/bin/tailscale or via Mac App Store
TAILSCALE_CMD=""
if command -v tailscale &>/dev/null; then
    TAILSCALE_CMD="tailscale"
elif [ -e "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
    TAILSCALE_CMD="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
fi

if [ -n "$TAILSCALE_CMD" ]; then
    TS_STATUS=$($TAILSCALE_CMD status --self --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Self',{}).get('Online','unknown'))" 2>/dev/null || echo "unknown")
    if [ "$TS_STATUS" = "True" ]; then
        TS_IP=$($TAILSCALE_CMD ip -4 2>/dev/null || echo "unknown")
        pass "Tailscale online ($TS_IP)"
    else
        warn "Tailscale installed but not connected"
        info "Open Tailscale from the menu bar and connect"
        ((WARNINGS++))
    fi
else
    if $FIX && command -v brew &>/dev/null; then
        fixing "Tailscale"
        brew install --cask tailscale
        ((FIXED++))
        warn "Tailscale installed — open it from Applications and sign in"
    else
        warn "Tailscale not installed (needed for gateway connection)"
        info "Install: brew install --cask tailscale"
        ((WARNINGS++))
    fi
fi

# Test gateway reachability
if command -v curl &>/dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 https://patricks-macmini.pangolin-typhon.ts.net/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        pass "Gateway reachable at patricks-macmini.pangolin-typhon.ts.net"
    else
        LOCALHOST_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://127.0.0.1:18789/ 2>/dev/null || echo "000")
        if [ "$LOCALHOST_CODE" = "200" ]; then
            pass "Gateway reachable at localhost:18789"
        else
            warn "Gateway not reachable (is OpenClaw running? is Tailscale connected?)"
            ((WARNINGS++))
        fi
    fi
fi

# ── GitHub CLI ──
header "Git"
if command -v git &>/dev/null; then
    pass "git $(git --version | awk '{print $3}')"
else
    if $FIX && command -v brew &>/dev/null; then
        fixing "git"
        brew install git
        ((FIXED++))
    else
        fail "git not installed"
        ((ERRORS++))
    fi
fi

if command -v gh &>/dev/null; then
    pass "GitHub CLI $(gh --version | head -1 | awk '{print $3}')"
else
    if $FIX && command -v brew &>/dev/null; then
        fixing "GitHub CLI"
        brew install gh
        ((FIXED++))
    else
        warn "GitHub CLI not installed"
        info "Run: brew install gh"
        ((WARNINGS++))
    fi
fi

# ── Claude Code ──
header "Claude Code"
if command -v claude &>/dev/null; then
    CLAUDE_VER=$(claude --version 2>/dev/null || echo "unknown")
    pass "Claude Code $CLAUDE_VER"
else
    warn "Claude Code not found in PATH"
    info "Install: npm install -g @anthropic-ai/claude-code"
    ((WARNINGS++))
fi

# ── Summary ──
echo ""
header "Summary"
if $FIX && [ "$FIXED" -gt 0 ]; then
    echo -e "  ${BLUE}$FIXED item(s) installed.${NC}"
fi

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "  ${GREEN}All clear!${NC} Ready to build The Fireplace."
elif [ "$ERRORS" -eq 0 ]; then
    echo -e "  ${YELLOW}$WARNINGS warning(s)${NC} — you can proceed but some features may not work."
else
    echo -e "  ${RED}$ERRORS error(s)${NC}, ${YELLOW}$WARNINGS warning(s)${NC}"
    if ! $FIX; then
        echo -e "  Run ${BOLD}./scripts/doctor.sh --fix${NC} to auto-install missing dependencies."
    fi
fi
echo ""
