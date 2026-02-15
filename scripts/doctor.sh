#!/bin/bash
# The Fireplace — Dependency Doctor
# Checks and installs everything needed to develop the app.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
header() { echo -e "\n${BOLD}$1${NC}"; }

ERRORS=0
WARNINGS=0

header "The Fireplace — Dependency Doctor"
echo ""

# ── Xcode Command Line Tools ──
header "Xcode"
if xcode-select -p &>/dev/null; then
    pass "Xcode Command Line Tools installed"
else
    fail "Xcode Command Line Tools missing"
    echo "    → Run: xcode-select --install"
    ((ERRORS++))
fi

# ── Homebrew ──
header "Homebrew"
if command -v brew &>/dev/null; then
    pass "Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
    fail "Homebrew not installed"
    echo "    → Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    ((ERRORS++))
fi

# ── Rust ──
header "Rust"
if command -v rustc &>/dev/null; then
    RUST_VER=$(rustc --version | awk '{print $2}')
    pass "rustc $RUST_VER"
else
    fail "Rust not installed"
    echo "    → Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    ((ERRORS++))
fi

if command -v cargo &>/dev/null; then
    pass "cargo $(cargo --version | awk '{print $2}')"
else
    fail "cargo not found"
    ((ERRORS++))
fi

# Check for iOS/macOS Rust targets
if command -v rustup &>/dev/null; then
    if rustup target list --installed | grep -q "aarch64-apple-darwin"; then
        pass "Rust target: aarch64-apple-darwin (macOS ARM)"
    else
        warn "Missing Rust target: aarch64-apple-darwin"
        echo "    → Run: rustup target add aarch64-apple-darwin"
        ((WARNINGS++))
    fi
    if rustup target list --installed | grep -q "aarch64-apple-ios"; then
        pass "Rust target: aarch64-apple-ios"
    else
        warn "Missing Rust target: aarch64-apple-ios (needed for iOS builds)"
        echo "    → Run: rustup target add aarch64-apple-ios"
        ((WARNINGS++))
    fi
    if rustup target list --installed | grep -q "aarch64-apple-ios-sim"; then
        pass "Rust target: aarch64-apple-ios-sim"
    else
        warn "Missing Rust target: aarch64-apple-ios-sim (needed for iOS simulator)"
        echo "    → Run: rustup target add aarch64-apple-ios-sim"
        ((WARNINGS++))
    fi
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
    fail "Node.js not installed"
    echo "    → Run: brew install node  (or use nvm/fnm)"
    ((ERRORS++))
fi

# ── pnpm ──
if command -v pnpm &>/dev/null; then
    pass "pnpm $(pnpm --version)"
else
    fail "pnpm not installed"
    echo "    → Run: npm install -g pnpm"
    ((ERRORS++))
fi

# ── Tauri CLI ──
header "Tauri"
if pnpm list -g @tauri-apps/cli 2>/dev/null | grep -q "@tauri-apps/cli"; then
    pass "Tauri CLI (global pnpm)"
elif command -v cargo &>/dev/null && cargo install --list 2>/dev/null | grep -q "tauri-cli"; then
    pass "Tauri CLI (cargo)"
else
    warn "Tauri CLI not found globally (will use project-local via pnpm)"
    echo "    → Optional: pnpm add -g @tauri-apps/cli"
    ((WARNINGS++))
fi

# ── Tailscale ──
header "Network"
if command -v tailscale &>/dev/null; then
    TS_STATUS=$(tailscale status --self --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Self',{}).get('Online','unknown'))" 2>/dev/null || echo "unknown")
    if [ "$TS_STATUS" = "True" ]; then
        TS_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
        pass "Tailscale online ($TS_IP)"
    else
        warn "Tailscale installed but not connected"
        echo "    → Run: tailscale up"
        ((WARNINGS++))
    fi
else
    warn "Tailscale not installed (needed for gateway connection)"
    echo "    → Install from: https://tailscale.com/download/mac"
    ((WARNINGS++))
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
            warn "Gateway not reachable (is OpenClaw running?)"
            ((WARNINGS++))
        fi
    fi
fi

# ── Claude Code ──
header "Claude Code"
if command -v claude &>/dev/null; then
    CLAUDE_VER=$(claude --version 2>/dev/null || echo "unknown")
    pass "Claude Code $CLAUDE_VER"
else
    warn "Claude Code not found in PATH"
    ((WARNINGS++))
fi

# ── Git ──
header "Git"
if command -v git &>/dev/null; then
    pass "git $(git --version | awk '{print $3}')"
else
    fail "git not installed"
    ((ERRORS++))
fi

if command -v gh &>/dev/null; then
    pass "GitHub CLI $(gh --version | head -1 | awk '{print $3}')"
else
    warn "GitHub CLI not installed"
    echo "    → Run: brew install gh"
    ((WARNINGS++))
fi

# ── Summary ──
echo ""
header "Summary"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "  ${GREEN}All clear!${NC} Ready to build The Fireplace."
elif [ "$ERRORS" -eq 0 ]; then
    echo -e "  ${YELLOW}$WARNINGS warning(s)${NC} — you can proceed but some features may not work."
else
    echo -e "  ${RED}$ERRORS error(s)${NC}, ${YELLOW}$WARNINGS warning(s)${NC} — fix errors before building."
fi
echo ""
