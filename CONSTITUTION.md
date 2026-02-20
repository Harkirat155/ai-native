# AI-Native VS Code Bridge — Constitution

## Purpose
Make VS Code’s developer capabilities **machine-operable** via stable, auditable APIs.

## Principles
1. Truth-seeking over assumptions: prefer diagnostics/tests/tasks output.
2. Deterministic interfaces: structured JSON, stable error codes, schema-valid responses.
3. VS Code is the kernel: reuse Tasks/DAP/LSP/diagnostics/formatters/controllers.
4. Observable by default: log every remote action + provide an event stream.
5. No safety theater: no default prompts; enforce only explicit user restrictions + kill switch.
6. Minimal, reviewable edits: prefer WorkspaceEdit + semantic refactors over raw text.

