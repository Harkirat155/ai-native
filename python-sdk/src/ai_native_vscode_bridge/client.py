from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional, Sequence

import websockets


class BridgeError(Exception):
    def __init__(self, code: str, message: str, data: Any = None):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.data = data


def _resolve_token(
    token: Optional[str],
    token_file: Optional[str],
    workspace_dir: Optional[str],
) -> str:
    if token:
        return token
    env = os.environ.get("BRIDGE_TOKEN") or os.environ.get("TOKEN") or ""
    if env:
        return env

    base = Path(workspace_dir) if workspace_dir else Path.cwd()
    p = Path(token_file) if token_file else (base / ".vscode" / "bridge.token")
    try:
        return p.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


@dataclass(frozen=True)
class BridgeClient:
    """
    One-shot async client: opens a new WebSocket per call (simple + robust).
    """

    port: int = 57110
    host: str = "127.0.0.1"
    token: str = ""
    token_file: Optional[str] = None
    workspace_dir: Optional[str] = None

    @staticmethod
    def from_workspace(
        *,
        port: int = 57110,
        token: Optional[str] = None,
        token_file: Optional[str] = None,
        workspace_dir: Optional[str] = None,
    ) -> "BridgeClient":
        tok = _resolve_token(token, token_file, workspace_dir)
        if not tok:
            raise BridgeError(
                "E_AUTH",
                "Missing token. Provide token, set $BRIDGE_TOKEN, or create .vscode/bridge.token.",
            )
        return BridgeClient(
            port=port, token=tok, token_file=token_file, workspace_dir=workspace_dir
        )

    async def call(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"ws://{self.host}:{self.port}"
        req_id = 1
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": {**(params or {}), "auth": {"token": self.token}},
        }
        async with websockets.connect(url) as ws:
            await ws.send(json.dumps(payload))
            raw = await ws.recv()
        resp = json.loads(raw)
        if "error" in resp and resp["error"]:
            e = resp["error"]
            raise BridgeError(str(e.get("code")), str(e.get("message")), e.get("data"))
        return resp["result"]


try:
    from .generated_methods import BridgeMethodsMixin  # type: ignore
except Exception:
    class BridgeMethodsMixin:  # type: ignore
        pass


class GeneratedBridgeClient(BridgeMethodsMixin, BridgeClient):
    """
    BridgeClient with one method-per-RPC (generated from docs/protocol-v1.json).
    """

    pass


class BridgeEventStream:
    """
    Persistent stream for events.*: yields `events.notification` payloads.
    """

    def __init__(
        self,
        *,
        port: int = 57110,
        host: str = "127.0.0.1",
        token: str,
        events: Optional[Sequence[str]] = None,
        replay: int = 0,
    ):
        self.port = port
        self.host = host
        self.token = token
        self.events = list(events) if events else None
        self.replay = replay
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._sub_id: Optional[str] = None

    @staticmethod
    def from_workspace(
        *,
        port: int = 57110,
        token: Optional[str] = None,
        token_file: Optional[str] = None,
        workspace_dir: Optional[str] = None,
        events: Optional[Sequence[str]] = None,
        replay: int = 0,
    ) -> "BridgeEventStream":
        tok = _resolve_token(token, token_file, workspace_dir)
        if not tok:
            raise BridgeError(
                "E_AUTH",
                "Missing token. Provide token, set $BRIDGE_TOKEN, or create .vscode/bridge.token.",
            )
        return BridgeEventStream(port=port, token=tok, events=events, replay=replay)

    async def __aenter__(self) -> "BridgeEventStream":
        url = f"ws://{self.host}:{self.port}"
        self._ws = await websockets.connect(url)
        await self._ws.send(
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "events.subscribe",
                    "params": {
                        "events": self.events,
                        "replay": self.replay,
                        "auth": {"token": self.token},
                    },
                }
            )
        )
        raw = await self._ws.recv()
        resp = json.loads(raw)
        if "error" in resp and resp["error"]:
            e = resp["error"]
            raise BridgeError(str(e.get("code")), str(e.get("message")), e.get("data"))
        self._sub_id = resp["result"]["subscriptionId"]
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._ws and self._sub_id:
            await self._ws.send(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "events.unsubscribe",
                        "params": {
                            "subscriptionId": self._sub_id,
                            "auth": {"token": self.token},
                        },
                    }
                )
            )
            try:
                await self._ws.recv()
            except Exception:
                pass
        if self._ws:
            await self._ws.close()
        self._ws = None
        self._sub_id = None

    def __aiter__(self) -> AsyncIterator[Dict[str, Any]]:
        return self._iter()

    async def _iter(self) -> AsyncIterator[Dict[str, Any]]:
        if not self._ws:
            raise RuntimeError("BridgeEventStream not connected; use `async with`.")
        while True:
            raw = await self._ws.recv()
            msg = json.loads(raw)
            # Expect notifications without id.
            if msg.get("method") == "events.notification":
                yield msg.get("params", {})
