#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap.sh [--workspace <path>] [--ref <git-ref>]

Goal: make installation agent-friendly when the tool is NOT present.
- If `vscode-bridge` is already installed, it just runs `doctor`.
- Otherwise it clones the repo (if needed), builds artifacts, runs install.sh, then runs `doctor`.

Requirements:
- git
- VS Code CLI `code` on PATH
- Node/npm available (for building from source)
EOF
}

workspace="$(pwd)"
ref="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace) workspace="$2"; shift 2 ;;
    --ref) ref="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if command -v vscode-bridge >/dev/null 2>&1; then
  vscode-bridge doctor
  exit 0
fi

tmp="${TMPDIR:-/tmp}/ai-native-bootstrap.$$"
mkdir -p "$tmp"

repo_dir="$tmp/ai-native"
git clone --depth 1 --branch "$ref" https://github.com/Harkirat155/ai-native "$repo_dir" >/dev/null

cd "$repo_dir"

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
fi

npm install --silent
npm run -s build
npm run -s package:vsix
npm run -s package:controller:mac || true

./scripts/install.sh --workspace "$workspace"

export PATH="$HOME/.local/bin:$PATH"
vscode-bridge doctor

