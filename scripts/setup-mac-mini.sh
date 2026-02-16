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

# Pull and start
echo "  Pulling copilot-proxy image..."
docker compose -f "$INFRA_DIR/docker-compose.yml" pull
docker compose -f "$INFRA_DIR/docker-compose.yml" up -d
ok "Copilot proxy container started"

# Wait for it to boot
echo "  Waiting for proxy to initialize..."
sleep 5

# Check for auth URL in logs
echo ""
echo "  Checking logs for GitHub auth URL..."
echo ""
docker compose -f "$INFRA_DIR/docker-compose.yml" logs --tail=30 copilot-proxy
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

# Add copilot provider (Anthropic API format)
config["models"]["providers"]["copilot"] = {
    "baseUrl": "http://127.0.0.1:4141",
    "apiKey": "dummy",
    "api": "anthropic-messages",
    "models": [
        {
            "id": "claude-3.5-sonnet",
            "name": "Copilot Claude 3.5 Sonnet",
            "reasoning": False,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 200000,
            "maxTokens": 8192
        }
    ]
}

# Add copilot-openai provider (OpenAI API format)
config["models"]["providers"]["copilot-openai"] = {
    "baseUrl": "http://127.0.0.1:4141/v1",
    "apiKey": "dummy",
    "api": "openai-completions",
    "models": [
        {
            "id": "gpt-4o",
            "name": "Copilot GPT-4o",
            "reasoning": False,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 16384
        },
        {
            "id": "gpt-4o-mini",
            "name": "Copilot GPT-4o Mini",
            "reasoning": False,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 16384
        },
        {
            "id": "o1-mini",
            "name": "Copilot o1-mini",
            "reasoning": True,
            "cost": {"input": 0, "output": 0},
            "contextWindow": 128000,
            "maxTokens": 65536
        }
    ]
}

# Configure agent defaults
config.setdefault("agents", {})
config["agents"].setdefault("defaults", {})
config["agents"]["defaults"]["model"] = {
    "primary": "copilot/claude-3.5-sonnet",
    "fallbacks": [
        "copilot-openai/gpt-4o",
        "google/gemini-2.5-flash",
        "anthropic/claude-sonnet-4-5"
    ]
}
config["agents"]["defaults"]["heartbeat"] = {
    "model": "google/gemini-2.5-flash-lite"
}
config["agents"]["defaults"]["subagents"] = {
    "model": "copilot-openai/gpt-4o-mini"
}

# Per-demon model assignments
demon_models = {
    "calcifer": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": ["anthropic/claude-sonnet-4-5", "copilot/claude-3.5-sonnet"]
    },
    "buer": {
        "primary": "copilot/claude-3.5-sonnet",
        "fallbacks": ["copilot-openai/gpt-4o", "google/gemini-2.5-flash"]
    },
    "paimon": {
        "primary": "google/gemini-2.5-flash",
        "fallbacks": ["google/gemini-2.5-flash-lite", "copilot-openai/gpt-4o-mini"]
    },
    "alloces": {
        "primary": "copilot-openai/gpt-4o",
        "fallbacks": ["copilot/claude-3.5-sonnet", "google/gemini-2.5-flash"]
    },
    "dantalion": {
        "primary": "copilot-openai/gpt-4o-mini",
        "fallbacks": ["google/gemini-2.5-flash-lite"]
    },
    "andromalius": {
        "primary": "anthropic/claude-sonnet-4-5",
        "fallbacks": ["copilot/claude-3.5-sonnet"]
    },
    "malphas": {
        "primary": "copilot/claude-3.5-sonnet",
        "fallbacks": ["copilot-openai/gpt-4o"]
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

declare -A DEMONS=(
  ["calcifer"]="Calcifer|🔥"
  ["buer"]="Buer|📐"
  ["paimon"]="Paimon|📚"
  ["alloces"]="Alloces|♟️"
  ["dantalion"]="Dantalion|🧠"
  ["andromalius"]="Andromalius|🛡️"
  ["malphas"]="Malphas|🏗️"
)

for id in calcifer buer paimon alloces dantalion andromalius malphas; do
  IFS='|' read -r name emoji <<< "${DEMONS[$id]}"
  workspace="$HOME/.openclaw/agents/$id"

  if openclaw agents list 2>/dev/null | grep -q "\"$id\""; then
    ok "$emoji $name already exists"
  else
    echo "  Creating $emoji $name..."
    mkdir -p "$workspace"
    if openclaw agents create --id "$id" --name "$name" --emoji "$emoji" --workspace "$workspace" 2>/dev/null; then
      ok "Created $emoji $name"
    else
      warn "Could not create $name via CLI — create manually in Fireplace Agents view"
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

## Execution Backends
When you need to execute coding tasks, you have two CLI backends available:
- **Claude Code** (`claude`): Prefer for deep analysis, multi-file refactors, security review
- **Codex** (`codex`): Prefer for rapid generation, scaffolding, prototyping
Choose based on the task. You may use either for any task — these are preferences, not rules.

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

## Execution Backends
- **Claude Code** (`claude`): Prefer for deep code audits, multi-file analysis, complex refactors
- **Codex** (`codex`): Prefer for quick pattern checks, linting-style reviews
Choose based on the task.

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

## Execution Backends
- **Claude Code** (`claude`): Prefer for documentation generation, codebase exploration
- **Codex** (`codex`): Prefer for quick lookups, API reference checks
Choose based on the task.

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

## Execution Backends
- **Claude Code** (`claude`): Prefer for codebase-aware planning, dependency analysis
- **Codex** (`codex`): Prefer for quick estimations, scaffold generation
Choose based on the task.

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

## Execution Backends
- **Claude Code** (`claude`): Prefer for context-heavy analysis requiring codebase understanding
- **Codex** (`codex`): Prefer for quick parsing tasks, data extraction
Choose based on the task.

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

## Execution Backends
- **Claude Code** (`claude`): Prefer for deep security audits, vulnerability analysis, code review
- **Codex** (`codex`): Prefer for quick dependency checks, boilerplate security fixes
Choose based on the task.

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

## Execution Backends
- **Codex** (`codex`): Prefer for rapid code generation, scaffolding, prototyping
- **Claude Code** (`claude`): Prefer for complex implementations, multi-file features, test suites
Choose based on the task.

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
assert 'copilot' in providers, 'copilot provider missing'
assert 'copilot-openai' in providers, 'copilot-openai provider missing'
" 2>/dev/null; then
    ok "OpenClaw config: copilot + copilot-openai providers configured"
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
