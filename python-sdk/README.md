# ai-native-bridge

> Async Python SDK for the [AI-Native VS Code Bridge](https://github.com/Harkirat155/ai-native) — drive VS Code from agents via JSON-RPC over WebSocket.

## Install

```bash
pip install ai-native-bridge
```

Or for development:

```bash
pip install -e ./python-sdk
```

## Quick Start

```python
import asyncio
from ai_native_vscode_bridge import BridgeClient

async def main():
    client = BridgeClient.from_workspace(port=57110)

    # Check connectivity
    pong = await client.call("bridge.ping")
    print(pong)  # {"ok": true, "protocol": "v1-draft"}

    # List all diagnostics (errors & warnings)
    diags = await client.call("diagnostics.list")
    for file_entry in diags.get("files", []):
        print(f"{file_entry['uri']}: {len(file_entry['diagnostics'])} issues")

asyncio.run(main())
```

## Features

- **One-shot async calls** — each `client.call()` opens a fresh WebSocket (simple + robust).
- **Event streaming** — `BridgeEventStream` for real-time diagnostics, file changes, debug events.
- **Auto-generated method wrappers** — `GeneratedBridgeClient` with typed methods for every RPC endpoint.
- **Token auto-discovery** — reads `$BRIDGE_TOKEN`, `--token-file`, or `.vscode/bridge.token`.

## Event Streaming

```python
from ai_native_vscode_bridge import BridgeEventStream

async def watch():
    async with BridgeEventStream.from_workspace(
        events=["diagnostics.changed", "doc.saved"]
    ) as stream:
        async for event in stream:
            print(event)
```

## API Reference

| Class | Purpose |
| --- | --- |
| `BridgeClient` | One-shot async JSON-RPC calls |
| `GeneratedBridgeClient` | `BridgeClient` + auto-generated method wrappers |
| `BridgeEventStream` | Persistent WebSocket for event subscriptions |
| `BridgeError` | Structured error with `.code`, `.message`, `.data` |

## License

Apache-2.0
