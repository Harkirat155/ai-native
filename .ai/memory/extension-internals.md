---
topic: extension-internals
tags: [extension, rpc, handlers, websocket, state-management]
updated: 2026-02-24
confidence: high
related: [protocol-methods]
---

# Extension Internals

## State Management

All state is closure-captured inside `activate()`:

| Variable | Type | Purpose |
|----------|------|---------|
| `connected` | `Set<WebSocket>` | Active WebSocket connections |
| `diagSubscribers` | `Set<WebSocket>` | Connections listening for diagnostics |
| `debugSubscribers` | `Set<WebSocket>` | Connections listening for debug events |
| `txById` | `Map<string, Tx>` | Active transactions |
| `snapshotById` | `Map<string, Snapshot>` | Git stash snapshots |
| `eventSubsById` | `Map<string, EventSub>` | Event subscriptions |
| `eventSubsBySocket` | `Map<WebSocket, Set<string>>` | Socket → subscription mapping |
| `eventBuffer` | `Array` | Last 200 events for replay |

## Request Flow

```
WebSocket message → JSON.parse → isJsonRpcRequest() → auth check →
switch(msg.method) → handler logic → send(ok(...)) or send(err(...))
```

## Key Helper Functions

- `parseUri(uri)` → `vscode.Uri` — validates and parses file URIs
- `parsePosition(pos)` → `vscode.Position` — validates line/character
- `parseRange(r)` → `vscode.Range` — validates start/end positions
- `serializeDiagnostic(d)` — converts VS Code diagnostic to JSON-safe format
- `applyTextEdits(doc, baseText, edits)` — applies edits from end-to-start for stable offsets
- `unifiedDiffForDoc(uri, base, new)` — generates unified diff using `diff` library
- `canExecuteCommand(cmd)` — checks allow/deny restrictions

## Event System

- `emitEvent(name, params)` — buffers event + pushes to subscribers
- Events are filtered per-subscription (via `EventSub.filter`)
- Replay: `events.subscribe` with `replay: N` re-sends last N matching events
- Buffer max: 200 events (FIFO)

## Transaction System

1. `tx.begin` → creates `Tx { id, createdAt, staged: Map }`
2. `doc.applyEdits.preview` → reads doc, applies edits in-memory, stores in staged
3. `tx.preview` → generates unified diffs for all staged docs
4. `tx.commit` → validates versions + applies via WorkspaceEdit
5. `tx.rollback` → deletes from txById
