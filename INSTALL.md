# Installation (one command)

This project ships:
- a VS Code extension (the bridge)
- an external controller (`vscode-bridge`)

## Quick install (from a release bundle)

### macOS / Linux
From the extracted bundle directory:
```bash
./scripts/install.sh --workspace /path/to/your/workspace
```

Then:
```bash
vscode-bridge doctor
```

### Windows (PowerShell)
From the extracted bundle directory:
```powershell
.\scripts\install.ps1 -Workspace C:\path\to\your\workspace
```

Then:
```powershell
vscode-bridge.exe doctor
```

## What this does
- Installs the VSIX via `code --install-extension`
- Installs the controller binary to a user-writable bin directory
- Writes workspace settings:
  - `bridge.enabled=true`
  - `bridge.pairing.exportTokenPath=.vscode/bridge.token`

