---
name: protocol-check
description: Reference the OpenClaw gateway protocol source to verify types, methods, events, and message formats are correct.
allowed-tools: Read, Grep, Glob
---

Verify protocol implementation against the OpenClaw gateway source.

## Protocol Source Locations

The canonical protocol definitions live in the installed OpenClaw package:

```
/Users/admin/.nvm/versions/node/v24.13.1/lib/node_modules/openclaw/dist/plugin-sdk/gateway/protocol/
```

## What to Check

1. **Frame types** — verify `req`, `res`, `event` frame shapes match source
2. **Method names** — confirm RPC method strings (e.g., `chat.send`, `sessions.list`) are correct
3. **Param types** — verify request parameter shapes for each method
4. **Payload types** — verify response payload shapes
5. **Event names** — confirm event strings (e.g., `connect.challenge`, `chat`, `exec.approval.requested`)
6. **Error codes** — check error code strings and shapes

## How to Use

When implementing or updating gateway types:

1. Read the relevant protocol source file
2. Compare with our `src/gateway/types.ts`
3. Flag any mismatches
4. Update our types to match the source exactly

## Gateway Docs

Full protocol documentation:
```
/Users/admin/.nvm/versions/node/v24.13.1/lib/node_modules/openclaw/docs/gateway/
```

## Important

- Always trust the source files over any cached knowledge
- The protocol may have been updated — always re-read before verifying
- Pay special attention to optional vs required fields
