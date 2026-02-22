# AI-Native VS Code Bridge

Expose VS Code’s capabilities (tasks, diagnostics, formatting, code intel, refactors, debugging, UI helpers, notebooks) over a **local JSON-RPC (WebSocket) API** so agents and CLI tools can drive the same workflows humans do in the VS Code UI.

## What you get

- **VS Code extension** (`extension/`): runs a localhost WebSocket server (`ws://127.0.0.1:<port>`) and implements the bridge methods.
- **Controller** (`client/`): a CLI/binary that calls bridge methods and can run `doctor` for self-checks.

## Quick install (release-bundle style)

See **[INSTALL.md](./INSTALL.md)**.

## Agent-first discovery (when nothing is installed)

Agents can discover this toolchain via the well-known repo manifest: `.well-known/ai-native.json` (includes bootstrap install commands + healthcheck).

## Quick start (dev)

```bash
source ~/.nvm/nvm.sh
npm install
npm run build
```

In VS Code:

- Run the extension: `.vscode/launch.json` → **Run VS Code Bridge Extension** (F5)
- (Optional) Seamless pairing: set workspace setting:
  - `bridge.pairing.exportTokenPath`: `.vscode/bridge.token`
  - reload the window once

Then from a terminal in the workspace:

```bash
npm run -s bridge -- doctor
npm run -s bridge -- --method bridge.capabilities
```

## Pairing (token)

The extension stores a token in VS Code SecretStorage. For seamless onboarding it can also export it to a file:

- Setting: `bridge.pairing.exportTokenPath`
- Recommended: `.vscode/bridge.token` (ignored via `.gitignore`)

The controller resolves token in this order:

1) `--token`
2) `$BRIDGE_TOKEN` (or `$TOKEN`)
3) `--token-file`
4) `./.vscode/bridge.token` (default)

## Controller usage

```bash
# Call any JSON-RPC method
npm run -s bridge -- --method diagnostics.list

# With explicit params
npm run -s bridge -- --method doc.read --params '{"uri":"file:///..."}'
```

## Capabilities discovery

Agents/tools should always start with:

- `vscode-bridge doctor` (environment sanity)
- `bridge.capabilities` (method + event surface)

## MCP compatibility (stdio)

Run an MCP server that exposes bridge methods as MCP tools:

```bash
npm run -s bridge -- mcp
```

## Protocol v1 (schemas + OpenAPI + LLM toolpack)

Generated artifacts:

- `protocol/schemas/v1.json` (canonical JSON Schema bundle)
- `protocol/openapi.json` (OpenAPI 3.1 wrapper)
- `docs/protocol-v1.json` (LLM toolpack)
- `docs/protocol-v1.md` (human reference)

Regenerate:

```bash
npm run -s protocol:generate
```

## Packaging

- Build VSIX: `npm run -s package:vsix` → `dist/vscode-bridge.vsix`
- Build controller binaries:
  - macOS: `npm run -s package:controller:mac` → `dist/vscode-bridge-arm64` / `dist/vscode-bridge-x64`

## Headless mode

Scaffold lives in `headless/`:

```bash
docker build -t ai-native-bridge -f headless/Dockerfile .
```

## Python SDK (async)

Python package lives in `python-sdk/`.

Generate method wrappers from the LLM toolpack:

```bash
npm run -s protocol:generate
npm run -s python:sdk:generate
```

Install (editable):

```bash
python3 -m pip install -e ./python-sdk
```

## Safety / restrictions

Default behavior is low-friction. You can explicitly restrict what commands can be executed via the bridge:

- `bridge.restrictions.commands.allow`
- `bridge.restrictions.commands.deny`

## Workflows

See **[WORKFLOWS.md](./WORKFLOWS.md)** for canonical “agent inner loop” recipes.

## Trace sidebar

Open **Bridge → Trace** in the Activity Bar (or run command **“VS Code Bridge: Open Trace”**) to see recent RPC calls and events.

## Examples

See **[examples/](./examples/)** for ready-to-run agent scripts:

- **`simple_agent.py`** — connects to the bridge, finds every diagnostic in your workspace, and auto-fixes them using code actions.

```bash
pip install -e ./python-sdk
python examples/simple_agent.py --dry-run
```

## Ecosystem nodes

Scaffold adapters live in `nodes/` (starting with a minimal LangGraph-style wrapper).

## Agent Skill (agentskills.io)

This repo ships an [Agent Skill](https://agentskills.io) in `vscode-bridge/` — a portable, cross-platform skill package that teaches AI agents how to install, connect to, and use the bridge.

**Supported platforms:** Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor, VS Code, and 20+ more.

```
vscode-bridge/
├── SKILL.md                    # Main skill file (discovery + instructions)
├── scripts/
│   ├── bootstrap.sh            # Install the bridge
│   ├── doctor.sh               # Health check
│   └── call.sh                 # Call any bridge method
└── references/
    └── PROTOCOL-QUICK-REF.md   # Complete method reference
```

To use: symlink or copy the `vscode-bridge/` folder into your agent's skills directory. The agent will automatically discover and activate the skill when relevant tasks arise.

## GitHub Topics

For discoverability, add these topics to the GitHub repo:
`ai-agents` · `vscode-extension` · `json-rpc` · `agentic-coding` · `mcp` · `agent-skills`
