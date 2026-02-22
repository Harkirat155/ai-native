#!/usr/bin/env bash
# doctor.sh — Quick health-check for the VS Code Bridge.
#
# Usage:
#   bash vscode-bridge/scripts/doctor.sh [--port 57110]
#
# Checks:
#   1. vscode-bridge CLI is on PATH
#   2. Bridge WebSocket is reachable
#   3. Token is valid (bridge.ping succeeds)

set -euo pipefail

PORT="${1:-57110}"
if [[ "$PORT" == "--port" ]]; then
  PORT="${2:-57110}"
fi

PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" &>/dev/null; then
    echo "  ✅ $label"
    ((PASS++))
  else
    echo "  ❌ $label"
    ((FAIL++))
  fi
}

echo "🩺 VS Code Bridge Health Check"
echo ""

# Check 1: CLI available
check "vscode-bridge CLI found" command -v vscode-bridge

# Check 2: WebSocket port open
check "WebSocket port $PORT reachable" bash -c "echo > /dev/tcp/127.0.0.1/$PORT 2>/dev/null"

# Check 3: bridge.ping responds
if command -v vscode-bridge &>/dev/null; then
  check "bridge.ping succeeds" vscode-bridge --method bridge.ping
else
  # Fall back to npm script if available
  if [[ -f package.json ]] && grep -q '"bridge"' package.json; then
    check "bridge.ping succeeds (via npm)" npm run -s bridge -- --method bridge.ping
  else
    echo "  ⏭️  Skipped bridge.ping (CLI not found)"
  fi
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "💡 Tips:"
  echo "   - Ensure VS Code is running with the Bridge extension active"
  echo "   - Check that bridge.pairing.exportTokenPath is set to .vscode/bridge.token"
  echo "   - Reload the VS Code window after enabling the extension"
  exit 1
fi
