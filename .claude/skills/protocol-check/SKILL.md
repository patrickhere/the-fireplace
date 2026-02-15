---
name: protocol-check
description: Reference the OpenClaw gateway protocol source to verify types, methods, events, and message formats are correct.
allowed-tools: Read, Grep, Glob
---

Verify protocol implementation against the OpenClaw gateway source.

## Protocol Source (In-Repo)

All protocol type definitions are committed to the repo at:

```
docs/protocol/           — top-level types (index.d.ts, client-info.d.ts, schema.d.ts)
docs/protocol/schema/    — all method/event schemas:
  ├── frames.d.ts         — req/res/event frame types
  ├── primitives.d.ts     — base types
  ├── types.d.ts          — shared type definitions
  ├── logs-chat.d.ts      — chat.send, chat.history, chat.abort, logs.tail
  ├── sessions.d.ts       — sessions.list, sessions.preview, sessions.patch, etc.
  ├── channels.d.ts       — channels.status, channels.logout
  ├── agents-models-skills.d.ts — agents.*, models.list, skills.*
  ├── agent.d.ts          — agent type definitions
  ├── config.d.ts         — config.get, config.set, config.patch, config.apply
  ├── cron.d.ts           — cron.* methods
  ├── devices.d.ts        — device.* methods
  ├── exec-approvals.d.ts — exec approval methods and events
  ├── snapshot.d.ts       — hello-ok snapshot shape
  ├── error-codes.d.ts    — error code strings
  ├── nodes.d.ts          — node pairing
  ├── wizard.d.ts         — wizard flows
  └── protocol-schemas.d.ts — master schema registry
```

## Gateway Docs (In-Repo)

Key gateway documentation at:

```
docs/gateway/
  ├── protocol.md               — full protocol spec
  ├── authentication.md         — auth modes and flows
  ├── pairing.md                — device pairing
  ├── tailscale.md              — Tailscale integration
  └── configuration-reference.md — config schema
```

## What to Check

1. **Frame types** — verify `req`, `res`, `event` frame shapes match `docs/protocol/schema/frames.d.ts`
2. **Method names** — confirm RPC method strings match the schema files
3. **Param types** — verify request parameter shapes for each method
4. **Payload types** — verify response payload shapes
5. **Event names** — confirm event strings (e.g., `connect.challenge`, `chat`, `exec.approval.requested`)
6. **Error codes** — check against `docs/protocol/schema/error-codes.d.ts`

## How to Use

When implementing or updating gateway types:

1. Read the relevant schema file from `docs/protocol/schema/`
2. Compare with our `src/gateway/types.ts`
3. Flag any mismatches
4. Update our types to match the source exactly

## Updating the Reference

When OpenClaw updates, copy fresh types from the Mac Mini:
```bash
# Run from the Mac Mini (or SSH into it)
OPENCLAW_ROOT="$(npm root -g)/openclaw"
cp $OPENCLAW_ROOT/dist/plugin-sdk/gateway/protocol/*.d.ts docs/protocol/
cp $OPENCLAW_ROOT/dist/plugin-sdk/gateway/protocol/schema/*.d.ts docs/protocol/schema/
```

## Important

- Always trust the files in `docs/protocol/` over any cached knowledge
- Pay special attention to optional vs required fields
- The `protocol-schemas.d.ts` file has the master registry of all method → param/response mappings
