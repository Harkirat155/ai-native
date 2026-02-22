#!/usr/bin/env bash
# bootstrap.sh — Install the AI-Native VS Code Bridge from source.
#
# Usage (from the repo root):
#   bash vscode-bridge/scripts/bootstrap.sh [--workspace /path/to/workspace]
#
# If --workspace is omitted, defaults to the current directory.

set -euo pipefail

WORKSPACE="${1:-$PWD}"

# Strip the flag name if passed as --workspace <path>
if [[ "$WORKSPACE" == "--workspace" ]]; then
  WORKSPACE="${2:-$PWD}"
fi

echo "🚀 Bootstrapping AI-Native VS Code Bridge …"
echo "   Workspace: $WORKSPACE"

# Detect OS
case "$(uname -s)" in
  Darwin|Linux)
    if command -v curl &>/dev/null; then
      curl -fsSL https://raw.githubusercontent.com/Harkirat155/ai-native/main/scripts/bootstrap.sh \
        | bash -s -- --workspace "$WORKSPACE"
    elif command -v wget &>/dev/null; then
      wget -qO- https://raw.githubusercontent.com/Harkirat155/ai-native/main/scripts/bootstrap.sh \
        | bash -s -- --workspace "$WORKSPACE"
    else
      echo "❌ Neither curl nor wget found. Please install one and retry."
      exit 1
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "⚠️  On Windows, use PowerShell instead:"
    echo "   iwr -useb https://raw.githubusercontent.com/Harkirat155/ai-native/main/scripts/bootstrap.ps1 | iex"
    echo "   bootstrap-ai-native -Workspace \$pwd"
    exit 1
    ;;
  *)
    echo "❌ Unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

echo ""
echo "✅ Bootstrap complete. Run 'vscode-bridge doctor' to verify."
