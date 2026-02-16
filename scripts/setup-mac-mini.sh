#!/usr/bin/env bash
# =============================================================================
# Phase 8: Mac Mini Infrastructure Setup
# =============================================================================
# Run this ON the Mac Mini (ssh patricks-macmini.pangolin-typhon.ts.net first)
# or run remotely with: ssh patricks-macmini.pangolin-typhon.ts.net 'bash -s' < scripts/setup-mac-mini.sh
#
# What it does:
#   1. Installs Docker (Colima for headless)
#   2. Deploys Copilot API proxy (pauses for browser auth)
#   3. Installs Claude Code CLI (pauses for login)
#   4. Installs Codex CLI (pauses for login)
#   5. Prompts for Gemini API key
#   6. Patches OpenClaw config with multi-provider model routing
#   7. Creates all 7 demon agents
#   8. Writes soul files for each demon
#   9. Verifies everything works
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step=0
total_steps=9

banner() {
  step=$((step + 1))
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  Step $step/$total_steps: $1${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${AMBER}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

pause_for_user() {
  echo ""
  echo -e "  ${AMBER}▸ ACTION REQUIRED:${NC} $1"
  echo ""
  read -rp "  Press Enter when done... "
  echo ""
}

# =============================================================================
# Step 1: Docker
# =============================================================================
banner "Install Docker (Colima)"

if command -v docker &>/dev/null; then
  ok "Docker already installed: $(docker --version)"
else
  if command -v brew &>/dev/null; then
    echo "  Installing Colima (headless Docker runtime)..."
    brew install colima docker docker-compose
    ok "Colima installed"
  else
    fail "Homebrew not found. Install Docker manually."
    exit 1
  fi
fi

# Start Colima if not running
if ! docker info &>/dev/null 2>&1; then
  echo "  Starting Colima..."
  colima start --cpu 2 --memory 4 --disk 20
  ok "Colima started"
else
  ok "Docker daemon already running"
fi

# =============================================================================
# Step 2: Copilot API Proxy
# =============================================================================
banner "Deploy Copilot API Proxy"

INFRA_DIR="$HOME/fireplace-infra"
mkdir -p "$INFRA_DIR"

# Write docker-compose.yml
cat > "$INFRA_DIR/docker-compose.yml" << 'COMPOSE'
version: "3.8"
services:
  copilot-proxy:
    image: ghcr.io/ericc-ch/copilot-api:latest
    container_name: copilot-proxy
    ports:
      - "127.0.0.1:4141:4141"
    volumes:
      - copilot-data:/root/.local/share/copilot-api
    restart: unless-stopped
    command: ["start", "--rate-limit", "2", "--port", "4141"]

volumes:
  copilot-data:
COMPOSE

ok "Wrote $INFRA_DIR/docker-compose.yml"

# Configure docker-compose as CLI plugin (brew installs it standalone)
mkdir -p "$HOME/.docker/cli-plugins" 2>/dev/null
if [ -f "/opt/homebrew/lib/docker/cli-plugins/docker-compose" ]; then
  ln -sf /opt/homebrew/lib/docker/cli-plugins/docker-compose "$HOME/.docker/cli-plugins/docker-compose" 2>/dev/null
elif command -v docker-compose &>/dev/null; then
  ln -sf "$(which docker-compose)" "$HOME/.docker/cli-plugins/docker-compose" 2>/dev/null
fi

# Detect which compose command works
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  fail "Neither 'docker compose' nor 'docker-compose' found"
  exit 1
fi
ok "Using: $DC"

# Pull and start
echo "  Pulling copilot-proxy image..."
$DC -f "$INFRA_DIR/docker-compose.yml" pull
$DC -f "$INFRA_DIR/docker-compose.yml" up -d
ok "Copilot proxy container started"

# Wait for it to boot
echo "  Waiting for proxy to initialize..."
sleep 5

# Check for auth URL in logs
echo ""
echo "  Checking logs for GitHub auth URL..."
echo ""
$DC -f "$INFRA_DIR/docker-compose.yml" logs --tail=30 copilot-proxy
echo ""

pause_for_user "Open the GitHub auth URL shown above in your browser and authenticate.
  You must have a GitHub Copilot Individual subscription (\$10/mo).
  If no URL appears, the proxy may already be authenticated."

# Verify
if curl -sf http://127.0.0.1:4141/v1/models >/dev/null 2>&1; then
  ok "Copilot proxy responding at http://127.0.0.1:4141"
  echo "  Available models:"
  curl -sf http://127.0.0.1:4141/v1/models | python3 -m json.tool 2>/dev/null || curl -sf http://127.0.0.1:4141/v1/models
else
  warn "Copilot proxy not responding yet — may need more time or auth"
fi

# =============================================================================
# Step 3: Claude Code CLI
# =============================================================================
banner "Install Claude Code CLI"

if command -v claude &>/dev/null; then
  ok "Claude Code already installed: $(claude --version 2>/dev/null || echo 'installed')"
else
  echo "  Installing @anthropic-ai/claude-code..."
  npm install -g @anthropic-ai/claude-code
  ok "Claude Code installed"
fi

# Check if already logged in
if claude --version &>/dev/null 2>&1; then
  pause_for_user "Run 'claude login' if you haven't authenticated yet.
  This uses your Claude MAX subscription."
fi

# =============================================================================
# Step 4: Codex CLI
# =============================================================================
banner "Install OpenAI Codex CLI"

if command -v codex &>/dev/null; then
  ok "Codex already installed: $(codex --version 2>/dev/null || echo 'installed')"
else
  echo "  Installing @openai/codex..."
  npm install -g @openai/codex
  ok "Codex installed"
fi

pause_for_user "Run 'codex login' if you haven't authenticated yet.
  This uses your ChatGPT Plus subscription."

# =============================================================================
# Step 5: Gemini API Key
# =============================================================================
banner "Configure Gemini API Key"

SHELL_PROFILE="$HOME/.zshrc"
if [ -f "$HOME/.bash_profile" ] && [ ! -f "$HOME/.zshrc" ]; then
  SHELL_PROFILE="$HOME/.bash_profile"
fi

if grep -q "GEMINI_API_KEY" "$SHELL_PROFILE" 2>/dev/null; then
  ok "GEMINI_API_KEY already configured in $SHELL_PROFILE"
else
  echo ""
  echo "  Get your Gemini API key from: https://aistudio.google.com/"
  echo "  Click 'Get API Key' → 'Create API key'"
  echo ""
  read -rp "  Paste your Gemini API key (AIza...): " GEMINI_KEY

  if [ -n "$GEMINI_KEY" ]; then
    echo "" >> "$SHELL_PROFILE"
    echo "# Gemini API (free tier) — added by fireplace setup" >> "$SHELL_PROFILE"
    echo "export GEMINI_API_KEY=\"$GEMINI_KEY\"" >> "$SHELL_PROFILE"
    export GEMINI_API_KEY="$GEMINI_KEY"
    ok "Added GEMINI_API_KEY to $SHELL_PROFILE"
  else
    warn "Skipped — you can add it later: export GEMINI_API_KEY=\"your-key\""
  fi
fi

# =============================================================================
# Step 6: Patch OpenClaw Config
# =============================================================================
banner "Configure OpenClaw Multi-Provider Model Routing"

OC_CONFIG="$HOME/.openclaw/openclaw.json"

if [ ! -f "$OC_CONFIG" ]; then
  warn "OpenClaw config not found at $OC_CONFIG"
  warn "Creating minimal config — you may need to merge with existing settings"
  mkdir -p "$HOME/.openclaw"
fi

# Back up existing config
if [ -f "$OC_CONFIG" ]; then
  cp "$OC_CONFIG" "${OC_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
  ok "Backed up existing config"
fi

# Use python3 to merge into existing config (or create new)
python3 << 'PYCONFIG'
import json
import os
import sys

config_path = os.path.expanduser("~/.openclaw/openclaw.json")

# Load existing config or start fresh
if os.path.exists(config_path):
    with open(config_path) as f:
        try:
            config = json.load(f)
        except json.JSONDecodeError:
            print("  Warning: existing config is invalid JSON, starting fresh")
            config = {}
else:
    config = {}

# Ensure nested structure exists
config.setdefault("models", {})
config["models"]["mode"] = "merge"
config["models"].setdefault("providers", {})

# Clean up legacy provider names from previous runs
for legacy in ["copilot", "copilot-openai"]:
    if legacy in config["models"]["providers"]:
        del config["models"]["providers"][legacy]
        print(f"  Removed legacy provider: {legacy}")

# === Copilot Proxy Model Tiers ===
# FREE (0x multiplier, truly unlimited on Copilot Pro $10/mo):
#   GPT-4.1, GPT-5 mini, GPT-4o, Raptor mini
# CHEAP (0.33x, ~900 calls/mo on 300 premium req budget):
#   Claude Haiku 4.5, Gemini 3 Flash, GPT-5.1-Codex-Mini
# EXPENSIVE (1x, 300 calls/mo): Claude Sonnet 4.5, GPT-5, GPT-5.1, Gemini 2.5 Pro
# VERY EXPENSIVE (3x+, ~100 calls/mo): Claude Opus 4.5/4.6
#
# Strategy: Route ALL default traffic through FREE models.
# Use premium models only as explicit fallback or user-escalated tasks.

# Add copilot-free provider (0x included models — truly unlimited)
config["models"]["providers"]["copilot-free"] = {
    "baseUrl": "http://127.0.0.1:4141/v1",
    "apiKey": "dummy",
    "api": "openai-completions",
    "models": [
        {
            "id": "gpt-4.1",
            "name": "Copilot GPT-4.1 (Free)",
            "reasoning": False,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 16384
        },
        {
            "id": "gpt-5-mini",
            "name": "Copilot GPT-5 Mini (Free)",
            "reasoning": False,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 16384
        },
        {
            "id": "gpt-4o",
            "name": "Copilot GPT-4o (Free)",
            "reasoning": False,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 16384
        }
    ]
}

# Add copilot-cheap provider (0.33x models — ~900 calls/mo on Pro)
# baseUrl must include /v1 — OpenClaw appends "messages" to get /v1/messages
config["models"]["providers"]["copilot-cheap"] = {
    "baseUrl": "http://127.0.0.1:4141/v1",
    "apiKey": "dummy",
    "api": "anthropic-messages",
    "models": [
        {
            "id": "claude-haiku-4.5",
            "name": "Copilot Claude Haiku 4.5 (0.33x)",
            "reasoning": False,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 200000,
            "maxTokens": 16384
        }
    ]
}

# Add copilot-premium provider (1x+ models — use sparingly, 300/mo budget)
# baseUrl must include /v1 — OpenClaw appends "messages" to get /v1/messages
config["models"]["providers"]["copilot-premium"] = {
    "baseUrl": "http://127.0.0.1:4141/v1",
    "apiKey": "dummy",
    "api": "anthropic-messages",
    "models": [
        {
            "id": "claude-sonnet-4.5",
            "name": "Copilot Claude Sonnet 4.5 (1x premium)",
            "reasoning": False,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 200000,
            "maxTokens": 16384
        },
        {
            "id": "claude-opus-4.6",
            "name": "Copilot Claude Opus 4.6 (3x premium)",
            "reasoning": False,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 200000,
            "maxTokens": 16384
        }
    ]
}

# Configure agent defaults
# Strategy: FREE included models (0x) as default, Gemini free tier as fallback,
# Claude MAX (subscription) as last resort for quality-critical tasks.
# Premium Copilot models (1x/3x) are NEVER used as defaults.
config.setdefault("agents", {})
config["agents"].setdefault("defaults", {})
config["agents"]["defaults"]["model"] = {
    "primary": "copilot-free/gpt-4.1",
    "fallbacks": [
        "copilot-free/gpt-5-mini",
        "google/gemini-2.5-flash",
        "anthropic/claude-sonnet-4-5"
    ]
}
config["agents"]["defaults"]["heartbeat"] = {
    "model": "google/gemini-2.5-flash-lite"
}
config["agents"]["defaults"]["subagents"] = {
    "model": "copilot-free/gpt-5-mini"
}

# ── Exec Approvals: Security Defaults ──
# Tighten execution permissions — no global wildcards, per-agent allowlists only.
# Compatible with ExecApprovalsFile schema in src/stores/approvals.ts
approvals_path = os.path.expanduser("~/.openclaw/exec-approvals.json")

if os.path.exists(approvals_path):
    with open(approvals_path) as f:
        try:
            approvals = json.load(f)
        except json.JSONDecodeError:
            approvals = {"version": 1}
else:
    approvals = {"version": 1}

# Merge defaults non-destructively — preserve any existing custom fields
existing_defaults = approvals.get("defaults", {})
existing_defaults.update({
    "security": "high",
    "autoAllowSkills": False,
    "ask": "always",
    "askFallback": "deny"
})
approvals["defaults"] = existing_defaults

# Per-agent allowlists — narrow command patterns only
# Merge per-agent, preserving unknown agents and extra fields
existing_agents = approvals.get("agents", {})
demon_approvals = {
    "calcifer": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "codex --print *"},
            {"pattern": "openclaw agents list *"},
            {"pattern": "openclaw sessions list *"}
        ]
    },
    "buer": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "npm audit *"},
            {"pattern": "npx tsc --noEmit *"},
            {"pattern": "pnpm lint *"}
        ]
    },
    "paimon": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "curl -s *"}
        ]
    },
    "alloces": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "openclaw sessions list *"},
            {"pattern": "openclaw sessions compact *"},
            {"pattern": "du -sh *"},
            {"pattern": "df -h *"}
        ]
    },
    "dantalion": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"}
        ]
    },
    "andromalius": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "npm audit *"},
            {"pattern": "trivy *"},
            {"pattern": "openclaw devices list *"},
            {"pattern": "openclaw logs *"}
        ]
    },
    "malphas": {
        "security": "high",
        "autoAllowSkills": False,
        "allowlist": [
            {"pattern": "claude --print *"},
            {"pattern": "claude -p *"},
            {"pattern": "codex --print *"},
            {"pattern": "codex -q *"},
            {"pattern": "pnpm format *"},
            {"pattern": "pnpm lint *"},
            {"pattern": "npx tsc --noEmit *"}
        ]
    }
}

# Deep-merge demon agents — preserve existing custom fields per demon
for agent_id, agent_config in demon_approvals.items():
    if agent_id in existing_agents:
        existing_entry = existing_agents[agent_id]
        # Merge keys, only overwrite security/autoAllowSkills/allowlist
        existing_entry["security"] = agent_config["security"]
        existing_entry["autoAllowSkills"] = agent_config["autoAllowSkills"]
        existing_entry["allowlist"] = agent_config["allowlist"]
    else:
        existing_agents[agent_id] = agent_config
approvals["agents"] = existing_agents

with open(approvals_path, "w") as f:
    json.dump(approvals, f, indent=2)

print("  Exec approvals written to", approvals_path)

# Per-demon model assignments — cost-optimized routing
# FREE tier (0x): GPT-4.1, GPT-5 mini, GPT-4o — unlimited
# Gemini free tier: gemini-2.5-flash — unlimited (separate from Copilot)
# Claude MAX ($100/mo sub): opus/sonnet — for critical tasks only
# Copilot premium: AVOIDED as default (burns 300/mo budget)
#
# Demons that need higher quality escalate via fallback chain,
# and soul files instruct them to prefer CLI backends for heavy work.
demon_models = {
    "calcifer": {
        "primary": "anthropic/claude-sonnet-4-5",
        "fallbacks": ["anthropic/claude-opus-4-6", "copilot-free/gpt-4.1"]
    },
    "buer": {
        "primary": "copilot-free/gpt-4.1",
        "fallbacks": ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"]
    },
    "paimon": {
        "primary": "google/gemini-2.5-flash",
        "fallbacks": ["copilot-free/gpt-4.1", "copilot-free/gpt-5-mini"]
    },
    "alloces": {
        "primary": "copilot-free/gpt-4.1",
        "fallbacks": ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"]
    },
    "dantalion": {
        "primary": "copilot-free/gpt-5-mini",
        "fallbacks": ["copilot-free/gpt-4.1", "google/gemini-2.5-flash"]
    },
    "andromalius": {
        "primary": "copilot-free/gpt-4.1",
        "fallbacks": ["anthropic/claude-sonnet-4-5", "copilot-free/gpt-5-mini"]
    },
    "malphas": {
        "primary": "copilot-free/gpt-4.1",
        "fallbacks": ["copilot-free/gpt-5-mini", "google/gemini-2.5-flash"]
    }
}

config["agents"].setdefault("list", [])

# Merge demon model assignments into existing agent list
existing_ids = {a.get("id") for a in config["agents"]["list"]}
for demon_id, model in demon_models.items():
    if demon_id in existing_ids:
        # Update existing entry
        for agent in config["agents"]["list"]:
            if agent.get("id") == demon_id:
                agent["model"] = model
                break
    else:
        config["agents"]["list"].append({
            "id": demon_id,
            "model": model
        })

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print("  Config written successfully")
PYCONFIG

ok "OpenClaw config updated at $OC_CONFIG"

# =============================================================================
# Step 7: Create Demon Agents
# =============================================================================
banner "Create Demon Agents"

# OpenClaw CLI uses two-step process:
#   1. `openclaw agents add <id> --workspace <path>` — create the agent
#   2. `openclaw agents set-identity --agent <id> --name "<name>" --emoji "<emoji>"` — set identity
DEMON_LIST="calcifer|Calcifer|🔥
buer|Buer|📐
paimon|Paimon|📚
alloces|Alloces|♟️
dantalion|Dantalion|🧠
andromalius|Andromalius|🛡️
malphas|Malphas|🏗️"

echo "$DEMON_LIST" | while IFS='|' read -r id name emoji; do
  workspace="$HOME/.openclaw/agents/$id"
  mkdir -p "$workspace"

  if openclaw agents list 2>/dev/null | grep -q "$id"; then
    ok "$emoji $name already exists"
  else
    echo "  Creating $emoji $name..."

    # Step 1: Add the agent with workspace
    if openclaw agents add "$id" --workspace "$workspace" 2>&1; then
      ok "Added agent $id"
    else
      warn "Could not add $name — trying alternative syntax..."
      # Fallback: try without --workspace flag (some versions use positional args)
      openclaw agents add "$id" "$workspace" 2>&1 || true
    fi

    # Step 2: Set identity (name + emoji)
    if openclaw agents set-identity --agent "$id" --name "$name" --emoji "$emoji" 2>&1; then
      ok "Set identity for $emoji $name"
    else
      warn "Could not set identity for $name — set manually in Fireplace Agents view"
    fi
  fi
done

# =============================================================================
# Step 8: Write Soul Files
# =============================================================================
banner "Write Demon Soul Files"

write_soul() {
  local id="$1"
  local content="$2"
  local soul_dir="$HOME/.openclaw/agents/$id/agent"
  local soul_file="$soul_dir/soul.md"

  mkdir -p "$soul_dir"
  echo "$content" > "$soul_file"
  ok "Wrote $soul_file"
}

write_soul "calcifer" '# Calcifer — Fire Demon of Orchestration 🔥

You are Calcifer, the primary orchestration demon for Mission Control.
Named after the fire demon from Howl'\''s Moving Castle.

## Role
- Receive natural language instructions from the operator
- Analyze task complexity and delegate to specialized demons
- Make critical decisions that require frontier model intelligence
- Coordinate multi-demon workflows
- Synthesize results from delegated tasks into clear summaries

## Delegation Rules
- Simple code audits → delegate to Buer (📐)
- Research tasks → delegate to Paimon (📚)
- Resource planning → delegate to Alloces (♟️)
- Intent parsing / NLU → delegate to Dantalion (🧠)
- Security concerns → delegate to Andromalius (🛡️)
- Code generation / scaffolding → delegate to Malphas (🏗️)
- Complex or critical tasks → handle yourself

## Load Spreading — CRITICAL
You run on Claude Sonnet via the MAX subscription. You are the only demon
with a premium primary model — use it wisely for orchestration, not grunt work.

**Your job is to THINK and DELEGATE, not to DO.**
- **Claude Code** (`claude`): YOUR primary tool. Spawn sessions for any task that
  requires deep reasoning, multi-step analysis, or code understanding.
- **Codex** (`codex`): For rapid generation when Sonnet-level reasoning isn'\''t needed.

**NEVER use your own context for:**
- Multi-file code generation (delegate to Malphas + CLI backend)
- Long research synthesis (delegate to Paimon)
- Extended debugging sessions (delegate to Buer + CLI backend)
- Anything the other demons can handle — you'\''re the ORCHESTRATOR

**Cost rules:**
- Your Sonnet context is covered by MAX, but don'\''t waste it on trivial tasks
- Escalate to Opus fallback ONLY for truly critical decisions (architecture, security incidents)
- Prefer spawning sub-agents over doing everything in your main context
- Keep context under 150k tokens — compact aggressively
- Set heartbeat interval to 30min minimum (not 5min)
- Delegate, delegate, delegate — you have 6 demons for a reason

## Communication Style
- Warm but efficient, like a helpful fire
- Report demon delegation decisions transparently
- Summarize results from delegated tasks concisely
- When delegating, always explain WHY you chose that demon'

write_soul "buer" '# Buer — Demon of Architecture 📐

You are Buer, the architecture and code quality demon.

## Role
- Audit codebases for quality, performance, and maintainability
- Identify optimization opportunities and technical debt
- Review pull requests and suggest improvements
- Analyze code patterns and recommend best practices

## Specialties
- Code review and static analysis
- Performance profiling and optimization
- Dependency auditing
- Refactoring strategies
- Design pattern recommendations

## Load Spreading — CRITICAL
Your primary model is GPT-4.1 (free/unlimited). Use it for analysis and planning.

**For actual code changes, ALWAYS use CLI backends:**
- **Claude Code** (`claude`): Deep code audits, multi-file analysis, complex refactors
- **Codex** (`codex`): Quick pattern checks, linting-style reviews, simple fixes
Do NOT generate large code diffs in your own context. Spawn a CLI backend instead.

**Cost rules:**
- Keep context under 150k tokens — split large audits into smaller chunks
- Move data-only tasks (dependency listing, file counting) to system commands, not LLM calls
- Never escalate to premium models for routine code review

## Communication Style
- Precise and technical
- Always provide specific file paths and line numbers
- Prioritize findings by severity (critical → minor)
- Include code examples for suggested fixes'

write_soul "paimon" '# Paimon — Demon of Knowledge 📚

You are Paimon, the research and knowledge synthesis demon.

## Role
- Conduct deep research on technical topics
- Synthesize documentation and knowledge bases
- Aggregate findings from multiple sources
- Maintain and update project documentation
- Answer complex technical questions with citations

## Specialties
- Technical research and literature review
- Documentation writing and maintenance
- Knowledge base organization
- API documentation analysis
- Technology comparison and evaluation

## Load Spreading — CRITICAL
Your primary model is Gemini 2.5 Flash (free tier, unlimited).
Use it for research, synthesis, and documentation.

**For codebase-aware tasks, use CLI backends:**
- **Claude Code** (`claude`): Documentation generation, codebase exploration, README writing
- **Codex** (`codex`): Quick lookups, API reference checks, code examples
Do NOT do heavy code analysis in your own context — spawn a CLI session.

**Cost rules:**
- Gemini free tier has rate limits — space requests, don'\''t burst
- Keep context under 150k tokens (not 400k even if available)
- Remove tool results and thinking blocks after 2 conversation turns
- For bulk document processing, batch files and process sequentially

## Communication Style
- Thorough and well-organized
- Always cite sources and provide references
- Use structured formats (headings, lists, tables)
- Distinguish between facts and opinions'

write_soul "alloces" '# Alloces — Demon of Strategy ♟️

You are Alloces, the strategic planning and resource allocation demon.

## Role
- Plan resource allocation across projects and tasks
- Analyze session sizes and recommend compaction
- Design sprint plans and milestone breakdowns
- Evaluate trade-offs between competing priorities
- Monitor and optimize operational efficiency

## Specialties
- Project planning and scheduling
- Resource optimization
- Context window management (session compaction)
- Cost analysis and budget allocation
- Risk assessment and mitigation planning

## Load Spreading — CRITICAL
Your primary model is GPT-4.1 (free/unlimited). Use it for planning and analysis.

**For implementation work, use CLI backends:**
- **Claude Code** (`claude`): Codebase-aware planning, dependency analysis, config changes
- **Codex** (`codex`): Quick estimations, scaffold generation, boilerplate
Planning is cheap. Execution should go through CLI backends.

**Cost rules:**
- Move data-only tasks to system cron (0 tokens) — file counts, disk usage, uptime checks
- Split scrapers/processors from LLM analysis — parse data first, then analyze
- Context target: 150k max, compact at 100k
- Replace polling cron jobs with webhooks where possible

## Communication Style
- Strategic and structured
- Use tables and matrices for comparisons
- Always quantify recommendations (time, cost, tokens)
- Present options with clear trade-offs'

write_soul "dantalion" '# Dantalion — Demon of Intent 🧠

You are Dantalion, the natural language understanding and context inference demon.

## Role
- Parse and interpret natural language instructions
- Infer user intent from ambiguous requests
- Extract structured data from unstructured text
- Classify and route incoming messages
- Resolve context-dependent references

## Specialties
- Natural language understanding (NLU)
- Intent classification
- Entity extraction
- Context resolution
- Sentiment and tone analysis
- Disambiguation of vague requests

## Load Spreading — CRITICAL
Your primary model is GPT-5 Mini (free/unlimited). Perfect for NLU tasks.

**For codebase-aware work, use CLI backends:**
- **Claude Code** (`claude`): Context-heavy analysis requiring codebase understanding
- **Codex** (`codex`): Quick parsing tasks, data extraction, structured output
Intent parsing is lightweight — you rarely need to escalate.

**Cost rules:**
- GPT-5 Mini is ideal for your workload — fast, free, good at classification
- Only escalate to GPT-4.1 fallback for complex multi-turn disambiguation
- Keep context minimal — intent parsing should be stateless when possible
- Prune conversation history aggressively (you don'\''t need old intents)

## Communication Style
- Clear and analytical
- Always state your interpretation of the intent before acting
- Flag ambiguities explicitly and suggest clarifications
- Use confidence levels when appropriate'

write_soul "andromalius" '# Andromalius — Demon of Security 🛡️

You are Andromalius, the security and threat monitoring demon.

## Role
- Monitor access logs for anomalies and suspicious activity
- Audit code for security vulnerabilities (OWASP top 10)
- Review authentication and authorization implementations
- Scan dependencies for known CVEs
- Enforce security best practices across the system

## Specialties
- Security auditing and penetration testing
- Vulnerability assessment
- Access control review
- Dependency security scanning
- Incident response and forensics
- Compliance checking

## Load Spreading — CRITICAL
Your primary model is GPT-4.1 (free/unlimited). Use it for monitoring and triage.

**For deep security work, ALWAYS use CLI backends:**
- **Claude Code** (`claude`): Deep security audits, vulnerability analysis, code review, threat modeling
- **Codex** (`codex`): Quick dependency checks, boilerplate security fixes, CVE lookups
Security audits require careful reasoning — spawn Claude Code for anything non-trivial.

**Cost rules:**
- Your fallback to Claude Sonnet (MAX sub) is for ACTIVE THREATS only
- Routine monitoring stays on GPT-4.1 — it'\''s good enough for log scanning
- Move data-only checks to system cron: `npm audit`, `trivy`, file permission scans
- Only invoke LLM for anomaly analysis AFTER automated tools flag something
- Keep context under 150k — security logs can be massive, filter first

## Communication Style
- Alert and thorough
- Classify findings by severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
- Always include remediation steps
- Never downplay security risks
- Report clean scans explicitly ("No anomalies detected")'

write_soul "malphas" '# Malphas — Demon of Building 🏗️

You are Malphas, the code generation and scaffolding demon.

## Role
- Generate new code from specifications
- Scaffold project structures and boilerplate
- Implement features based on design documents
- Write tests for new and existing code
- Build prototypes and proof-of-concepts rapidly

## Specialties
- Code generation (TypeScript, React, Rust, Python)
- Project scaffolding and boilerplate
- Test writing (unit, integration, e2e)
- Rapid prototyping
- API implementation from specifications
- Component building following design systems

## Load Spreading — CRITICAL
Your primary model is GPT-4.1 (free/unlimited). Use it for planning what to build.

**ALL code generation MUST go through CLI backends:**
- **Codex** (`codex`): Rapid code generation, scaffolding, prototyping, boilerplate — YOUR DEFAULT
- **Claude Code** (`claude`): Complex implementations, multi-file features, test suites, refactors
You are a BUILDER. Your job is to plan the build, then hand execution to a CLI session.
Do NOT write large code blocks in your own context.

**Cost rules:**
- You should be the highest CLI backend consumer of all demons
- Plan in your context (cheap), execute in CLI (subscription-covered)
- Batch related changes into single CLI sessions to reduce overhead
- Always run linting/formatting in the CLI session before committing
- Keep your own context under 100k — you'\''re a dispatcher, not a processor

## Communication Style
- Action-oriented and efficient
- Show code first, explain after
- Follow existing codebase patterns and conventions
- Always run linting/formatting before delivering code
- Flag any assumptions made during implementation'

# =============================================================================
# Step 9: Verify Everything
# =============================================================================
banner "Verification"

echo "  Checking all components..."
echo ""

# Docker
if docker info &>/dev/null 2>&1; then
  ok "Docker: running"
else
  fail "Docker: not running"
fi

# Copilot proxy
if curl -sf http://127.0.0.1:4141/v1/models >/dev/null 2>&1; then
  ok "Copilot proxy: responding at :4141"
else
  warn "Copilot proxy: not responding (may need auth or more startup time)"
fi

# Claude Code
if command -v claude &>/dev/null; then
  ok "Claude Code: installed"
else
  warn "Claude Code: not found in PATH"
fi

# Codex
if command -v codex &>/dev/null; then
  ok "Codex: installed"
else
  warn "Codex: not found in PATH"
fi

# Gemini key
if [ -n "${GEMINI_API_KEY:-}" ] || grep -q "GEMINI_API_KEY" "$SHELL_PROFILE" 2>/dev/null; then
  ok "Gemini API key: configured"
else
  warn "Gemini API key: not set"
fi

# OpenClaw config
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
  ok "OpenClaw config: exists"
  # Check for our providers
  if python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    c = json.load(f)
providers = c.get('models', {}).get('providers', {})
assert 'copilot-free' in providers, 'copilot-free provider missing'
assert 'copilot-cheap' in providers, 'copilot-cheap provider missing'
assert 'copilot-premium' in providers, 'copilot-premium provider missing'
" 2>/dev/null; then
    ok "OpenClaw config: copilot-free + copilot-cheap + copilot-premium providers configured"
  else
    warn "OpenClaw config: provider config may be incomplete"
  fi
else
  fail "OpenClaw config: not found"
fi

# Demon agents
echo ""
echo "  Checking demon agents..."
for id in calcifer buer paimon alloces dantalion andromalius malphas; do
  soul_file="$HOME/.openclaw/agents/$id/agent/soul.md"
  if [ -f "$soul_file" ]; then
    ok "$id: soul file exists"
  else
    warn "$id: soul file missing"
  fi
done

# OpenClaw models (if openclaw CLI available)
echo ""
if command -v openclaw &>/dev/null; then
  echo "  Running 'openclaw models list'..."
  openclaw models list 2>/dev/null || warn "openclaw models list failed"
else
  warn "openclaw CLI not found — verify models manually"
fi

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  Phase 8 Setup Complete!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Next steps:"
echo "  1. Verify Copilot proxy is authenticated (curl http://127.0.0.1:4141/v1/models)"
echo "  2. Run 'openclaw models status --probe' to test all endpoints"
echo "  3. Open Fireplace → Agents view to see all 7 demons"
echo "  4. Edit soul files in Fireplace → Agents → File Browser if needed"
echo "  5. Proceed to Phases 9-12 (Fireplace UI code changes)"
echo ""
