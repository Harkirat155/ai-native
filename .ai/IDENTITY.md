---
project: ai-native-vscode-bridge
version: 0.0.2
license: Apache-2.0
repo: https://github.com/Harkirat155/ai-native
author: Harkirat Singh
updated: 2026-02-24
---

# Project Identity

VS Code Bridge: expose VS Code's full capabilities (diagnostics, code actions,
refactoring, formatting, tasks, debugging, notebooks, UI) over a **local
JSON-RPC WebSocket API** so AI agents can drive the editor programmatically.

## Architecture

```
Agent/LLM ↔ CLI Controller (or MCP/Python SDK) ↔ WebSocket JSON-RPC ↔ VS Code Extension ↔ VS Code API
```

- Transport: `ws://127.0.0.1:57110` (configurable)
- Auth: per-session pairing token (SecretStorage → token file)
- Protocol: JSON-RPC 2.0, version `v1-draft`

## Module Map

| Module | Path | Entry | Role |
|--------|------|-------|------|
| **Extension** | `extension/` | `src/extension.ts` + `src/memory-handlers.ts` | WebSocket server + RPC handlers + project memory |
| **Controller CLI** | `client/` | `src/cli.ts` | CLI binary: `doctor`, `mcp`, `run-agent`, direct method calls |
| **Protocol** | `protocol/` | `src/index.ts` | Shared types, error codes, `METHODS` array, version constant |
| **Python SDK** | `python-sdk/` | `src/ai_native_vscode_bridge/` | Async Python SDK (`websockets`) + optional LangGraph wrapper |
| **Agent Skill** | `vscode-bridge/` | `SKILL.md` | Portable skill for agentskills.io (scripts + protocol reference) |
| **Website** | `website/` | Vite + React + Tailwind + shadcn/ui | Landing page / docs site |
| **Headless** | `headless/` | `Dockerfile` | Docker scaffold for headless VS Code + bridge |
| **LangGraph Node** | `nodes/` | `langgraph_bridge.py` | Minimal LangGraph-style node adapter |
| **Scripts** | `scripts/` | `bootstrap.sh`, `install.sh` | Cross-platform bootstrap/install helpers |
| **Examples** | `examples/` | `simple_agent.py` | Reference agent: auto-fix all diagnostics |

## Workspace Structure

npm workspaces: `protocol`, `extension`, `client`

```
root package.json → orchestrates build, typecheck, lint, packaging
├── npm run build          → builds all workspaces
├── npm run bridge         → node client/dist/cli.js (controller)
├── npm run package:vsix   → dist/vscode-bridge.vsix
├── npm run package:controller:{mac,linux,win}
├── npm run protocol:generate
└── npm run python:sdk:generate
```

## Key Dependencies

| Dependency | Where | Purpose |
|-----------|-------|---------|
| `ws` | extension, client | WebSocket server/client |
| `diff` | extension | Unified diff generation for tx preview |
| `esbuild` | extension, client | Build/bundle |
| `@vscode/vsce` | extension | VSIX packaging |
| `pkg` | client | Single-binary controller packaging |
| `websockets` | python-sdk | Async Python WebSocket client |
| `zod` | protocol/tools | Schema validation + code generation |

## RPC Method Surface (48 methods)

bridge: `ping`, `capabilities`
events: `subscribe`, `unsubscribe`
agent: `suggestNextSteps`, `planAndExecute`
tx: `begin`, `preview`, `commit`, `rollback`, `snapshot.create`, `snapshot.restore`
workspace: `info`
diagnostics: `list`, `subscribe`, `fix.preview`, `fix.commit`
doc: `read`, `applyEdits`, `applyEdits.preview`, `applyEdits.commit`, `format`
tasks: `list`, `run`, `run.capture`, `terminate`
code: `definitions`, `references`, `symbols.document`, `symbols.workspace`, `hover`
ui: `openFile`, `revealRange`, `focus`, `openPanel`, `quickPick`
debug: `sessions`, `start`, `stop`, `subscribe`, `runTestAndCaptureFailure`
notebook: `open`, `read`, `executeCells`
refactor: `rename`, `rename.preview`, `rename.commit`, `codeActions`, `codeActions.apply`, `organizeImports`, `fixAll`
symbols: `deepContext`
memory: `context.bootstrap`, `identity`, `conventions`, `decisions`, `search`, `learn`, `journal.write`, `list`

## CI/CD

- `.github/workflows/ci.yml` — build + typecheck on push/PR
- `.github/workflows/release.yml` — build VSIX + controller binaries, create GitHub Release
- `.github/workflows/test-release.yml` — test release flow
- `.github/workflows/test-pkg.yml` — test binary packaging
- `.github/workflows/publish-pypi.yml` — publish Python SDK to PyPI

## Discovery

- `.well-known/ai-native.json` — agent-first toolchain discovery manifest
- `vscode-bridge/SKILL.md` — agentskills.io portable skill
