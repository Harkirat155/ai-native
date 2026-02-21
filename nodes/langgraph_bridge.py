"""
LangGraph starter node wrappers (minimal, no external deps).

Usage idea (pseudo):
  from nodes.langgraph_bridge import bridge_call
  state = await bridge_call(state, method="bridge.capabilities", params={})
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ai_native_vscode_bridge import BridgeClient


async def bridge_call(
    state: Dict[str, Any],
    *,
    method: str,
    params: Optional[Dict[str, Any]] = None,
    port: int = 57110,
) -> Dict[str, Any]:
    client = BridgeClient.from_workspace(port=port)
    result = await client.call(method, params)
    state = dict(state)
    state["bridge:last"] = {"method": method, "params": params or {}, "result": result}
    return state

