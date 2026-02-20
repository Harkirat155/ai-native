# Canonical Workflows

The bridge is JSON-RPC over WebSocket; for quick manual calls you can use the included CLI:

```bash
# Easiest: export token to .vscode/bridge.token (see bridge.pairing.exportTokenPath)
npm run -s bridge -- --method bridge.capabilities
npm run -s bridge -- --method diagnostics.list

# Or explicitly pass a token
npm run -s bridge -- --token "$TOKEN" --method bridge.capabilities
```

## Fix diagnostics
1. `diagnostics.list`
2. For each item: `refactor.codeActions` → `refactor.codeActions.apply`
3. `doc.format`
4. `diagnostics.list` again

## Rename safely
1. `refactor.rename` at cursor with `newName`
3. `doc.format`
4. Verify with `code.references` + a task run

Example:
```bash
npm run -s bridge -- --token "$TOKEN" --method refactor.rename \
  --params '{"uri":"file:///...","position":{"line":0,"character":0},"newName":"NewSymbol"}'
```
