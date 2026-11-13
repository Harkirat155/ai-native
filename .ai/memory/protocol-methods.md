---
topic: protocol-methods
tags: [protocol, rpc, methods, schema, api-surface]
updated: 2026-02-24
confidence: high
related: [extension-internals]
---

# Protocol Methods Quick Reference

## Method Categories

### Bridge Core

| Method | Params | Returns |
|--------|--------|---------|
| `bridge.ping` | none | `{ ok, protocol }` |
| `bridge.capabilities` | none | `{ methods[], events[], limitations[] }` |

### Agent Automation

| Method | Params | Returns |
|--------|--------|---------|
| `agent.suggestNextSteps` | `{ goal?, maxSuggestions? }` | `{ suggestions[] }` |
| `agent.planAndExecute` | `{ goal, dryRun?, maxSteps? }` | `{ steps[], previewUnifiedDiff, committed, diagnosticsDelta }` |

### Transactions

| Method | Params | Returns |
|--------|--------|---------|
| `tx.begin` | none | `{ txId, createdAt }` |
| `tx.preview` | `{ txId }` | `{ files[] }` with unified diffs |
| `tx.commit` | `{ txId }` | `{ committed, fileCount }` |
| `tx.rollback` | `{ txId }` | `{ rolledBack }` |
| `tx.snapshot.create` | none | `{ snapshotId, kind, stashRef }` |
| `tx.snapshot.restore` | `{ snapshotId, dangerouslyDiscardLocalChanges }` | `{ restored }` |

### Diagnostics

| Method | Params | Returns |
|--------|--------|---------|
| `diagnostics.list` | `{ uri? }` | Array of `{ uri, diagnostics[] }` |
| `diagnostics.fix.preview` | `{ uri, diagnosticRange }` | Available fixes |
| `diagnostics.fix.commit` | `{ uri, diagnosticRange, actionIndex }` | Applied fix |

### Document Operations

| Method | Params | Returns |
|--------|--------|---------|
| `doc.read` | `{ uri }` | `{ content, languageId, version }` |
| `doc.applyEdits` | `{ uri, edits[] }` | Applied directly |
| `doc.applyEdits.preview` | `{ txId, uri, edits[] }` | Staged in transaction |
| `doc.format` | `{ uri }` | Formatted document |

### Refactoring

| Method | Params | Returns |
|--------|--------|---------|
| `refactor.rename` | `{ uri, position, newName }` | Renamed across project |
| `refactor.codeActions` | `{ uri, range }` | Available code actions |
| `refactor.codeActions.apply` | `{ uri, range, index }` | Applied action |
| `refactor.organizeImports` | `{ uri }` | Organized imports |
| `refactor.fixAll` | `{ uri }` | Fixed all auto-fixable issues |

### Code Navigation

| Method | Params | Returns |
|--------|--------|---------|
| `code.definitions` | `{ uri, position }` | Definition locations |
| `code.references` | `{ uri, position }` | Reference locations |
| `code.symbols.document` | `{ uri }` | Document symbols |
| `code.symbols.workspace` | `{ query }` | Workspace symbols |
| `code.hover` | `{ uri, position }` | Hover information |

### Events

| Method | Params | Returns |
|--------|--------|---------|
| `events.subscribe` | `{ events?, replay? }` | `{ subscriptionId }` |
| `events.unsubscribe` | `{ subscriptionId }` | `{ unsubscribed }` |

## Error Codes

| Code | Meaning |
|------|---------|
| `E_AUTH` | Invalid or missing token |
| `E_NOT_FOUND` | Resource not found (txId, file, subscription) |
| `E_INVALID_PARAMS` | Bad parameters |
| `E_FAILED` | Operation failed |
| `E_UNSUPPORTED` | Feature not supported |
| `E_PERMISSION` | Permission denied |
