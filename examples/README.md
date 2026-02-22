# Examples

## `simple_agent.py` — Fix All Diagnostics

A standalone agent that connects to the VS Code Bridge, finds every error and warning in your workspace, and applies available code-action fixes automatically.

### Prerequisites

1. VS Code running with the **VS Code Bridge** extension active
2. A workspace open with some lint errors or warnings
3. Python SDK installed:

   ```bash
   pip install ai-native-bridge
   # or from source:
   pip install -e ./python-sdk
   ```

### Run

```bash
# Fix all errors + warnings (default)
python examples/simple_agent.py

# Preview only (no changes applied)
python examples/simple_agent.py --dry-run

# Fix only errors (skip warnings)
python examples/simple_agent.py --severity error

# Custom bridge port
python examples/simple_agent.py --port 57110
```

### What it does

```text
observe → decide → act → verify
```

1. **Observe** — calls `diagnostics.list` to get all workspace diagnostics
2. **Decide** — for each diagnostic, calls `diagnostics.fix.preview` to check for available code actions
3. **Act** — picks the first (highest-priority) fix and calls `diagnostics.fix.commit`
4. **Verify** — re-fetches diagnostics and reports how many remain
