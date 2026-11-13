---
updated: 2026-02-24
scope: all-modules
---

# Coding Conventions

## Language & Style

- **Primary language**: TypeScript (strict mode, ES2022 target)
- **Secondary**: Python 3.10+ (typed, async-first)
- **Naming**: camelCase for functions/variables, PascalCase for types/classes
- **Imports**: explicit named imports, no barrel re-exports
- **String quotes**: double quotes in TypeScript (extension follows this)

## Architecture Patterns

### Extension (monolith style)

- Single `extension.ts` contains ALL RPC handlers in a massive `switch` statement
- Each `case` handles one JSON-RPC method
- Helper functions are module-scoped (not class-based)
- State is closure-captured: `txById`, `snapshotById`, `connected`, etc.
- Pattern: parse params → validate → call VS Code API → serialize result → `send(ok(...))`

### Error Handling

- Always use typed `BridgeErrorCode`: `E_AUTH`, `E_NOT_FOUND`, `E_INVALID_PARAMS`, `E_FAILED`, `E_UNSUPPORTED`, `E_PERMISSION`
- Return `err(msg.id, code, message, data?)` — never throw
- Validate params at method boundary, NOT deep inside

### Transactions (tx.*)

- Preview-before-commit pattern: `tx.begin` → `doc.applyEdits.preview` → `tx.preview` → `tx.commit / tx.rollback`
- `stageWorkspaceEdit()` captures base text + applies edits in memory
- `commitTx()` validates version hasn't changed before applying

### CLI Controller

- Pure function arg parsing (`parseArgs`)
- Subcommands: `doctor`, `mcp`, `run-agent` (checked with `argv[0]`)
- Token resolution cascade: `--token` → `$BRIDGE_TOKEN` → `$TOKEN` → `--token-file` → `.vscode/bridge.token`

## Testing

- No test framework yet (lint scripts echo "(no lint yet)")
- Validation: `npm run typecheck` (tsc --noEmit per workspace)
- Manual verification via `vscode-bridge doctor`
- Python SDK: pytest + pytest-asyncio + mypy (dev dependencies)

## Build

- Extension: esbuild (custom `scripts/build.mjs`), outputs to `extension/dist/`
- Client: tsc → dist/ (ESM), esbuild for single-binary bundling
- Protocol: tsc → dist/
- VSIX: `vsce package --no-dependencies --allow-missing-repository`

## File Organization Rules

- One workspace = one `package.json` + `src/` + `dist/`
- Generated artifacts: never commit `dist/`, commit `protocol/schemas/` and `docs/`
- Config: `.vscode/settings.json` for workspace settings, `.github/copilot-instructions.md` for Copilot rules
- Agent config: `AGENTS.md` (root), `.agents/rules/` (agent-specific rules)

## PR/Diff Philosophy

- **Minimal diffs** — avoid churn, speculative refactors
- **Semantic tools first** — prefer `refactor.*`, `diagnostics.fix.*` over raw `doc.applyEdits`
- **Structured results** — all RPC methods return structured JSON, never plain text
- **Stable error codes** — error codes are API contract, don't change them

## Gotchas

- `extension.ts` is 2400+ LOC — easy to create merge conflicts; edit surgically
- Token export uses `chmod(0o600)` — file permissions matter
- WebSocket is host-bound to `127.0.0.1` only (security)
- VSIX built with `--no-dependencies` — npm deps bundled by esbuild
- `pkg` for binary packaging requires `--targets` flag
