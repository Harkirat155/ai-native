#!/usr/bin/env python3
"""
simple_agent.py — Fix all diagnostics in a workspace using the VS Code Bridge.

This is the "killer example" for ai-native-bridge. It demonstrates the core
agent loop:  observe → decide → act → verify.

Usage:
    # 1. Start VS Code with the Bridge extension active
    # 2. Open a workspace with some lint errors / warnings
    # 3. Run:
    python examples/simple_agent.py

    # Or with explicit options:
    python examples/simple_agent.py --port 57110 --severity error

Requirements:
    pip install ai-native-bridge      # or: pip install -e ./python-sdk
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Any, Dict, List


# ---------------------------------------------------------------------------
# Import the SDK
# ---------------------------------------------------------------------------
try:
    from ai_native_vscode_bridge import BridgeClient
except ImportError:
    print(
        "❌  ai-native-bridge SDK not installed.\n"
        "    Run:  pip install ai-native-bridge   (or pip install -e ./python-sdk)\n"
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# Pretty helpers
# ---------------------------------------------------------------------------
SEVERITY_LABELS = {0: "Error", 1: "Warning", 2: "Info", 3: "Hint"}
SEVERITY_ICONS  = {0: "🔴", 1: "🟡", 2: "🔵", 3: "⚪"}


def short_uri(uri: str) -> str:
    """Strip the file:// prefix for readability."""
    return uri.replace("file://", "")


def fmt_diagnostic(d: Dict[str, Any]) -> str:
    sev = d.get("severity", 0)
    icon = SEVERITY_ICONS.get(sev, "❓")
    label = SEVERITY_LABELS.get(sev, "Unknown")
    rng = d.get("range", {}).get("start", {})
    line = rng.get("line", "?")
    col  = rng.get("character", "?")
    return f"  {icon} [{label}] L{line}:{col} — {d.get('message', '(no message)')}"


# ---------------------------------------------------------------------------
# Agent core
# ---------------------------------------------------------------------------
async def run_agent(port: int, severity_filter: str | None, dry_run: bool) -> None:
    client = BridgeClient.from_workspace(port=port)

    # ── Step 0: Health check ───────────────────────────────────────────
    print("🔌 Connecting to VS Code Bridge …")
    pong = await client.call("bridge.ping")
    print(f"   ✅  Connected (protocol: {pong.get('protocol', '?')})\n")

    # ── Step 1: Observe — list all diagnostics ─────────────────────────
    print("🔍 Fetching workspace diagnostics …")
    result = await client.call("diagnostics.list")
    files: List[Dict[str, Any]] = result.get("files", [])

    if not files:
        print("   🎉  No diagnostics — workspace is clean!")
        return

    # Optionally filter by severity
    min_sev = {"error": 0, "warning": 1, "info": 2, "hint": 3}.get(
        (severity_filter or "").lower(), 99
    )

    total_diags = 0
    fixable_files: List[Dict[str, Any]] = []

    for f in files:
        uri = f["uri"]
        diags = f.get("diagnostics", [])
        filtered = [d for d in diags if d.get("severity", 0) <= min_sev]
        if not filtered:
            continue
        total_diags += len(filtered)
        fixable_files.append({"uri": uri, "diagnostics": filtered})
        print(f"\n   📄 {short_uri(uri)}")
        for d in filtered:
            print(fmt_diagnostic(d))

    print(f"\n   📊 Found {total_diags} diagnostic(s) across {len(fixable_files)} file(s).\n")

    if total_diags == 0:
        print("   ✨  Nothing to fix (all filtered out).")
        return

    # ── Step 2: Decide + Act — preview & apply code-action fixes ───────
    fixed_count = 0
    skipped_count = 0

    for f_entry in fixable_files:
        uri = f_entry["uri"]
        diags = f_entry["diagnostics"]

        for diag in diags:
            # Ask the bridge for available code-action fixes
            try:
                preview = await client.call(
                    "diagnostics.fix.preview",
                    {
                        "uri": uri,
                        "diagnosticRange": diag.get("range"),
                    },
                )
            except Exception as exc:
                print(f"   ⚠️  Could not preview fix for {short_uri(uri)}: {exc}")
                skipped_count += 1
                continue

            actions = preview.get("actions", [])
            if not actions:
                skipped_count += 1
                continue

            # Pick the first (preferred / highest-priority) action
            action = actions[0]
            action_title = action.get("title", "(untitled)")

            if dry_run:
                print(f"   🔸 [DRY-RUN] Would apply: {action_title}  ({short_uri(uri)})")
                fixed_count += 1
                continue

            # Apply the fix
            try:
                commit_result = await client.call(
                    "diagnostics.fix.commit",
                    {
                        "uri": uri,
                        "diagnosticRange": diag.get("range"),
                        "actionIndex": action.get("index", 0),
                    },
                )
                ok = commit_result.get("applied", False)
                if ok:
                    print(f"   ✅ Fixed: {action_title}  ({short_uri(uri)})")
                    fixed_count += 1
                else:
                    print(f"   ❌ Failed to apply: {action_title}")
                    skipped_count += 1
            except Exception as exc:
                print(f"   ❌ Error applying fix: {exc}")
                skipped_count += 1

    # ── Step 3: Verify — re-fetch diagnostics ──────────────────────────
    print("\n─── Summary ───")
    mode_label = "(dry-run)" if dry_run else ""
    print(f"   ✅ Fixed: {fixed_count}  {mode_label}")
    print(f"   ⏭️  Skipped (no fix available): {skipped_count}")

    if not dry_run and fixed_count > 0:
        # Give VS Code a moment to recompute diagnostics
        await asyncio.sleep(1.5)
        result2 = await client.call("diagnostics.list")
        remaining = sum(
            len(f.get("diagnostics", [])) for f in result2.get("files", [])
        )
        print(f"   📊 Remaining diagnostics: {remaining}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fix all diagnostics in a VS Code workspace via the Bridge."
    )
    parser.add_argument(
        "--port", type=int, default=57110,
        help="Bridge WebSocket port (default: 57110)"
    )
    parser.add_argument(
        "--severity", choices=["error", "warning", "info", "hint"],
        default="warning",
        help="Minimum severity to fix (default: warning = errors + warnings)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview fixes without applying them"
    )
    args = parser.parse_args()
    asyncio.run(run_agent(args.port, args.severity, args.dry_run))


if __name__ == "__main__":
    main()
