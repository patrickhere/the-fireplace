# The Fireplace

Mission control for [OpenClaw](https://openclaw.ai) — a native macOS + iOS app that replaces the built-in Control UI and TUI.

Built with Tauri v2, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, and Zustand.

## What It Does

The Fireplace connects to an OpenClaw gateway over WebSocket and provides a full operator interface:

- **Chat** — streaming conversations with your agent (Calcifer)
- **Sessions** — list, preview, configure, and manage sessions
- **Channels** — WhatsApp, Discord, Slack, Telegram status and control
- **Agents** — multi-agent management with inline file editing
- **Config** — schema-driven gateway configuration editor
- **Approvals** — real-time exec approval notifications
- **Cron** — scheduled job management
- **Logs** — live log tailing with filters
- And more — skills, devices, models, usage tracking

## Development

```bash
pnpm install
pnpm tauri dev
```

## Architecture

See [PLAN.md](./PLAN.md) for the full technical plan.
