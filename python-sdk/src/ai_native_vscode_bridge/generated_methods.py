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

    async def code_definitions(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("code.definitions", params)

    async def code_hover(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("code.hover", params)

    async def code_references(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("code.references", params)

    async def code_symbols_document(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("code.symbols.document", params)

    async def code_symbols_workspace(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("code.symbols.workspace", params)

    async def debug_runTestAndCaptureFailure(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("debug.runTestAndCaptureFailure", params)

    async def debug_sessions(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("debug.sessions", params)

    async def debug_start(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("debug.start", params)

    async def debug_stop(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("debug.stop", params)

    async def debug_subscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("debug.subscribe", params)

    async def diagnostics_fix_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.fix.commit", params)

    async def diagnostics_fix_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.fix.preview", params)

    async def diagnostics_list(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.list", params)

    async def diagnostics_subscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("diagnostics.subscribe", params)

    async def doc_applyEdits(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.applyEdits", params)

    async def doc_applyEdits_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.applyEdits.commit", params)

    async def doc_applyEdits_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.applyEdits.preview", params)

    async def doc_format(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.format", params)

    async def doc_read(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("doc.read", params)

    async def events_subscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("events.subscribe", params)

    async def events_unsubscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("events.unsubscribe", params)

    async def notebook_executeCells(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("notebook.executeCells", params)

    async def notebook_open(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("notebook.open", params)

    async def notebook_read(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("notebook.read", params)

    async def refactor_codeActions(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.codeActions", params)

    async def refactor_codeActions_apply(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.codeActions.apply", params)

    async def refactor_fixAll(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.fixAll", params)

    async def refactor_organizeImports(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.organizeImports", params)

    async def refactor_rename(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.rename", params)

    async def refactor_rename_commit(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.rename.commit", params)

    async def refactor_rename_preview(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("refactor.rename.preview", params)

    async def symbols_deepContext(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("symbols.deepContext", params)

    async def tasks_list(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tasks.list", params)

    async def tasks_run(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tasks.run", params)

    async def tasks_run_capture(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tasks.run.capture", params)

    async def tasks_terminate(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("tasks.terminate", params)

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

    async def ui_focus(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("ui.focus", params)

    async def ui_openFile(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("ui.openFile", params)

    async def ui_openPanel(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("ui.openPanel", params)

    async def ui_quickPick(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("ui.quickPick", params)

    async def ui_revealRange(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("ui.revealRange", params)

    async def workspace_info(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.call("workspace.info", params)


