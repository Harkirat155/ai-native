---
topic: build-and-release
tags: [build, ci, release, vsix, packaging, github-actions]
updated: 2026-02-24
confidence: high
related: [extension-internals]
---

# Build & Release Pipeline

## Local Build

```bash
npm install          # install all workspaces
npm run build        # build protocol → extension → client
npm run typecheck    # tsc --noEmit per workspace
```

## Packaging

| Artifact | Command | Output |
|----------|---------|--------|
| VSIX | `npm run package:vsix` | `dist/vscode-bridge.vsix` |
| macOS binary | `npm run package:controller:mac` | `dist/vscode-bridge-arm64`, `dist/vscode-bridge-x64` |
| Linux binary | `npm run package:controller:linux` | `dist/vscode-bridge-linux-x64` |
| Windows binary | `npm run package:controller:win` | `dist/vscode-bridge-win-x64.exe` |
| Python SDK | `python3 -m build ./python-sdk` | wheel + sdist |

## Protocol Generation

```bash
npm run protocol:generate       # JSON Schema + OpenAPI + toolpack
npm run protocol:generate:zod   # Zod schemas
npm run python:sdk:generate     # Python SDK method wrappers
```

## CI Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | push, PR | Build + typecheck all workspaces |
| `release.yml` | tag push `v*` | Build VSIX + binaries, create GitHub Release |
| `test-release.yml` | manual | Test release flow |
| `test-pkg.yml` | manual | Test binary packaging |
| `publish-pypi.yml` | manual / release | Publish Python SDK to PyPI |

## Known Issues

- `ldid` binary download in release workflow had a 404 issue (fixed by verifying URL)
- VSIX requires `--no-dependencies` flag since deps are bundled by esbuild
- `pkg` requires specific Node 18 targets: `node18-{macos-arm64,macos-x64,linux-x64,win-x64}`
