# VS Code Bridge — Protocol Quick Reference

All methods are called via JSON-RPC over WebSocket (`ws://127.0.0.1:<port>`).
Use the CLI: `vscode-bridge --method <method> [--params '<json>']`

## Bridge

| Method | Description | Key Params |
|--------|-------------|------------|
| `bridge.ping` | Health check | — |
| `bridge.capabilities` | List all methods, events, limitations | — |

## Events

| Method | Description | Key Params |
|--------|-------------|------------|
| `events.subscribe` | Subscribe to editor events | `events[]`, `replay` |
| `events.unsubscribe` | Unsubscribe | `subscriptionId` |

## Agent

| Method | Description | Key Params |
|--------|-------------|------------|
| `agent.suggestNextSteps` | Get AI-suggested next actions | `goal`, `maxSuggestions` |
| `agent.planAndExecute` | Plan and execute a multi-step goal | `goal`, `dryRun`, `maxSteps` |

## Transactions

| Method | Description | Key Params |
|--------|-------------|------------|
| `tx.begin` | Start a transaction | — |
| `tx.preview` | Preview staged changes as unified diff | `txId` |
| `tx.commit` | Commit staged changes | `txId` |
| `tx.rollback` | Rollback staged changes | `txId` |
| `tx.snapshot.create` | Create git-stash checkpoint | — |
| `tx.snapshot.restore` | Restore from checkpoint | `snapshotId`, `dangerouslyDiscardLocalChanges` |

## Documents

| Method | Description | Key Params |
|--------|-------------|------------|
| `doc.read` | Read file content via VS Code | `uri` |
| `doc.applyEdits` | Apply text edits directly | `uri`, `edits[]` |
| `doc.applyEdits.preview` | Stage edits in a transaction | `txId`, `uri`, `edits[]` |
| `doc.applyEdits.commit` | Commit staged edits | `txId`, `uri` |
| `doc.format` | Format a document | `uri` |

## Diagnostics

| Method | Description | Key Params |
|--------|-------------|------------|
| `diagnostics.list` | List all workspace diagnostics | — |
| `diagnostics.subscribe` | Subscribe to diagnostic changes | — |
| `diagnostics.fix.preview` | Preview available fixes | `uri`, `diagnosticRange` |
| `diagnostics.fix.commit` | Apply a fix | `uri`, `diagnosticRange`, `actionIndex` |

## Refactoring

| Method | Description | Key Params |
|--------|-------------|------------|
| `refactor.rename` | Rename symbol across project | `uri`, `position`, `newName` |
| `refactor.rename.preview` | Preview rename changes | `uri`, `position`, `newName` |
| `refactor.rename.commit` | Commit rename | `uri`, `position`, `newName` |
| `refactor.codeActions` | List code actions at range | `uri`, `range` |
| `refactor.codeActions.apply` | Apply a code action | `uri`, `range`, `index` |
| `refactor.organizeImports` | Organize imports | `uri` |
| `refactor.fixAll` | Fix all auto-fixable issues | `uri` |

## Code Navigation

| Method | Description | Key Params |
|--------|-------------|------------|
| `code.definitions` | Go to definition | `uri`, `position` |
| `code.references` | Find all references | `uri`, `position` |
| `code.symbols.document` | Document outline / symbols | `uri` |
| `code.symbols.workspace` | Search symbols workspace-wide | `query` |
| `code.hover` | Hover information | `uri`, `position` |

## Tasks

| Method | Description | Key Params |
|--------|-------------|------------|
| `tasks.list` | List available tasks | — |
| `tasks.run` | Run a task | `label` |
| `tasks.run.capture` | Run and capture output | `label` |
| `tasks.terminate` | Stop a running task | `label` |

## Workspace

| Method | Description | Key Params |
|--------|-------------|------------|
| `workspace.info` | Get workspace metadata | — |

## UI

| Method | Description | Key Params |
|--------|-------------|------------|
| `ui.openFile` | Open file in editor | `uri` |
| `ui.revealRange` | Scroll to a range | `uri`, `range` |
| `ui.focus` | Focus VS Code window | — |
| `ui.openPanel` | Open a panel (terminal, output, etc.) | `panel` |
| `ui.quickPick` | Show a quick-pick menu | `items[]` |

## Debug

| Method | Description | Key Params |
|--------|-------------|------------|
| `debug.sessions` | List active debug sessions | — |
| `debug.start` | Start a debug session | `configuration` |
| `debug.stop` | Stop a debug session | `sessionId` |
| `debug.subscribe` | Subscribe to debug events | — |

## Notebooks

| Method | Description | Key Params |
|--------|-------------|------------|
| `notebook.open` | Open a notebook | `uri` |
| `notebook.read` | Read notebook contents | `uri` |
| `notebook.executeCells` | Execute notebook cells | `uri`, `cellIndexes[]` |

---

> **Canonical schema**: See `protocol/schemas/v1.json` for complete JSON Schema
> definitions including all property types and constraints.
>
> **Full docs**: See `docs/protocol-v1.md` for detailed input/output schemas.
