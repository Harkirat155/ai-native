# Generated file. Do not edit by hand.
# Source: docs/protocol-v1.json

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import BridgeClient

class BridgeMethodsMixin:
    async def agent_planAndExecute(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("agent.planAndExecute", params)

    async def agent_suggestNextSteps(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("agent.suggestNextSteps", params)

    async def bridge_capabilities(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("bridge.capabilities", params)

    async def bridge_ping(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("bridge.ping", params)

    async def diagnostics_fix_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.fix.commit", params)

    async def diagnostics_fix_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.fix.preview", params)

    async def diagnostics_list(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.list", params)

    async def doc_applyEdits_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.applyEdits.commit", params)

    async def doc_applyEdits_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.applyEdits.preview", params)

    async def doc_read(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.read", params)

    async def events_subscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("events.subscribe", params)

    async def events_unsubscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("events.unsubscribe", params)

    async def refactor_rename_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.rename.commit", params)

    async def refactor_rename_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.rename.preview", params)

    async def tasks_run_capture(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tasks.run.capture", params)

    async def tx_begin(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.begin", params)

    async def tx_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.commit", params)

    async def tx_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.preview", params)

    async def tx_rollback(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.rollback", params)

    async def tx_snapshot_create(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.snapshot.create", params)

    async def tx_snapshot_restore(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tx.snapshot.restore", params)


