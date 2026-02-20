# AI-Native VS Code Bridge — AGENTS

This repository is designed for **agentic coding** and **VS Code-native** automation.
Agents should use VS Code’s own primitives (Tasks, diagnostics, code actions, refactors) via the Bridge whenever possible.

## Agent workflow (preferred)
1. Discover capabilities: `bridge.capabilities`
2. Establish ground truth:
   - `diagnostics.list`
   - `tasks.list` + `tasks.run`
3. Navigate safely:
   - `code.definitions`, `code.references`, symbols, hover
4. Fix using the most semantic tool available:
   - `refactor.codeActions` / `refactor.rename.*` first
   - `doc.applyEdits` second
5. Format: `doc.format`
6. Verify: re-run tasks, re-check diagnostics

## Done means
- The requested change is implemented with minimal diffs
- Tasks/tests validate it (or failures are explicitly documented as unrelated)
- Diagnostics are reduced or unchanged with a clear reason

