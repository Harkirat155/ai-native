#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: ./scripts/install.sh [--workspace <path>]

Installs:
  - VS Code Bridge extension (from dist/vscode-bridge.vsix)
  - vscode-bridge controller binary (from dist/)
  - workspace settings to auto-export token to .vscode/bridge.token

Notes:
  - Requires VS Code CLI `code` available on PATH.
  - If you run this inside a repo/workspace, omit --workspace (defaults to cwd).
EOF
}

workspace="$(pwd)"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace) workspace="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if ! command -v code >/dev/null 2>&1; then
  cat <<'EOF' >&2
VS Code CLI 'code' was not found.

Install VS Code:
  https://code.visualstudio.com/download

Then enable the CLI:
  VS Code -> Command Palette -> "Shell Command: Install 'code' command in PATH"
EOF
  exit 1
fi

vsix="$root/dist/vscode-bridge.vsix"
if [[ ! -f "$vsix" ]]; then
  echo "Missing VSIX: $vsix" >&2
  exit 1
fi

os="$(uname -s)"
arch="$(uname -m)"

bin_src=""
if [[ "$os" == "Darwin" ]]; then
  if [[ "$arch" == "arm64" ]]; then
    bin_src="$root/dist/vscode-bridge-arm64"
  else
    bin_src="$root/dist/vscode-bridge-x64"
  fi
else
  # Linux: expects a platform-specific artifact in dist/ from release builds.
  bin_src="$root/dist/vscode-bridge-linux-x64"
fi

if [[ ! -f "$bin_src" ]]; then
  echo "Missing controller binary: $bin_src" >&2
  echo "Build it with: npm run package:controller:mac|linux|win" >&2
  exit 1
fi

install_bin_dir="${HOME}/.local/bin"
mkdir -p "$install_bin_dir"
install_bin="${install_bin_dir}/vscode-bridge"
cp "$bin_src" "$install_bin"
chmod +x "$install_bin"

echo "Installing extension VSIX…"
code --install-extension "$vsix" --force >/dev/null

mkdir -p "$workspace/.vscode"
settings="$workspace/.vscode/settings.json"

# Do not require Node for installation (agents may not have it).
python3 - "$settings" <<'PY'
import json
import os
import sys

p = sys.argv[1]
obj = {}
try:
  with open(p, "r", encoding="utf-8") as f:
    obj = json.load(f)
except Exception:
  obj = {}

obj["bridge.enabled"] = True
obj["bridge.pairing.exportTokenPath"] = ".vscode/bridge.token"

os.makedirs(os.path.dirname(p), exist_ok=True)
with open(p, "w", encoding="utf-8") as f:
  json.dump(obj, f, indent=2)
  f.write("\n")
PY

gitignore="$workspace/.gitignore"
if [[ -f "$gitignore" ]] && ! grep -q '^\.vscode/bridge\.token$' "$gitignore"; then
  echo ".vscode/bridge.token" >> "$gitignore"
fi

echo ""
echo "Done."
echo "0) Ensure controller is on PATH: export PATH=\"$install_bin_dir:\$PATH\""
echo "1) Open workspace: code \"$workspace\""
echo "2) Reload window once to let the extension export the token."
echo "3) Run: vscode-bridge doctor"
