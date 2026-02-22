#!/usr/bin/env bash
# call.sh — Call any VS Code Bridge JSON-RPC method.
#
# Usage:
#   bash vscode-bridge/scripts/call.sh <method> [params-json]
#
# Examples:
#   bash vscode-bridge/scripts/call.sh bridge.capabilities
#   bash vscode-bridge/scripts/call.sh diagnostics.list
#   bash vscode-bridge/scripts/call.sh doc.read '{"uri":"file:///path/to/file.ts"}'

set -euo pipefail

METHOD="${1:?Usage: call.sh <method> [params-json]}"
PARAMS="${2:-}"

if command -v vscode-bridge &>/dev/null; then
  if [[ -n "$PARAMS" ]]; then
    exec vscode-bridge --method "$METHOD" --params "$PARAMS"
  else
    exec vscode-bridge --method "$METHOD"
  fi
elif [[ -f package.json ]] && grep -q '"bridge"' package.json; then
  if [[ -n "$PARAMS" ]]; then
    exec npm run -s bridge -- --method "$METHOD" --params "$PARAMS"
  else
    exec npm run -s bridge -- --method "$METHOD"
  fi
else
  echo "❌ vscode-bridge CLI not found and no npm bridge script available."
  echo "   Run: bash vscode-bridge/scripts/bootstrap.sh"
  exit 1
fi
