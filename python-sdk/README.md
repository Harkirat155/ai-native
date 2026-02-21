# AI-Native VS Code Bridge — Python SDK

Async Python client for the VS Code Bridge (JSON-RPC over WebSocket).

## Install (editable)
```bash
python3 -m pip install -e ./python-sdk
```

## Quick start
```python
import asyncio
from ai_native_vscode_bridge import BridgeClient

async def main():
  client = BridgeClient.from_workspace(port=57110)
  caps = await client.call("bridge.capabilities")
  print(caps["methods"][:5])

asyncio.run(main())
```

## Events (event bus)
```python
import asyncio
from ai_native_vscode_bridge import BridgeEventStream

async def main():
  stream = BridgeEventStream.from_workspace(events=["tasks.exit"], replay=10)
  async with stream:
    async for ev in stream:
      print(ev["name"], ev["params"])

asyncio.run(main())
```

