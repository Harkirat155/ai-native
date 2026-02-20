# AI-Native VS Code Bridge

Expose VS Code’s capabilities (tasks, diagnostics, formatting, code intel, refactors, debugging, UI helpers, notebooks) over a **local JSON-RPC (WebSocket) API** so agents and CLI tools can drive the same workflows humans do in the VS Code UI.

## What you get
- **VS Code extension** (`extension/`): runs a localhost WebSocket server (`ws://127.0.0.1:<port>`) and implements the bridge methods.
- **Controller** (`client/`): a CLI/binary that calls bridge methods and can run `doctor` for self-checks.

## Quick install (release-bundle style)
See **[INSTALL.md](./INSTALL.md)**.

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

## Packaging
- Build VSIX: `npm run -s package:vsix` → `dist/vscode-bridge.vsix`
- Build controller binaries:
  - macOS: `npm run -s package:controller:mac` → `dist/vscode-bridge-arm64` / `dist/vscode-bridge-x64`

## Safety / restrictions
Default behavior is low-friction. You can explicitly restrict what commands can be executed via the bridge:
- `bridge.restrictions.commands.allow`
- `bridge.restrictions.commands.deny`

## Workflows
See **[WORKFLOWS.md](./WORKFLOWS.md)** for canonical “agent inner loop” recipes.

