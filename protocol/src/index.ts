export const PROTOCOL_VERSION = "v1-draft" as const;

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

export type BridgeErrorCode =
  | "E_AUTH"
  | "E_NOT_FOUND"
  | "E_INVALID_PARAMS"
  | "E_FAILED"
  | "E_UNSUPPORTED"
  | "E_PERMISSION";

export type JsonRpcError = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: BridgeErrorCode;
    message: string;
    data?: unknown;
  };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };
export type TextEdit = { range: Range; newText: string };

export const METHODS = [
  "bridge.ping",
  "bridge.capabilities",
  "events.subscribe",
  "events.unsubscribe",
  "agent.suggestNextSteps",
  "agent.planAndExecute",
  "tx.begin",
  "tx.snapshot.create",
  "tx.snapshot.restore",
  "tx.preview",
  "tx.commit",
  "tx.rollback",
  "workspace.info",
  "diagnostics.list",
  "diagnostics.subscribe",
  "diagnostics.fix.preview",
  "diagnostics.fix.commit",
  "doc.read",
  "doc.applyEdits.preview",
  "doc.applyEdits.commit",
  "doc.applyEdits",
  "doc.format",
  "tasks.list",
  "tasks.run",
  "tasks.run.capture",
  "tasks.terminate",
  "code.definitions",
  "code.references",
  "code.symbols.document",
  "code.symbols.workspace",
  "code.hover",
  "ui.openFile",
  "ui.revealRange",
  "ui.focus",
  "ui.openPanel",
  "ui.quickPick",
  "debug.sessions",
  "debug.start",
  "debug.stop",
  "debug.subscribe",
  "notebook.open",
  "notebook.read",
  "notebook.executeCells",
  "refactor.rename",
  "refactor.rename.preview",
  "refactor.rename.commit",
  "refactor.codeActions",
  "refactor.codeActions.apply",
  "refactor.organizeImports",
  "refactor.fixAll",
  "symbols.deepContext",
  "debug.runTestAndCaptureFailure"
] as const;

export type BridgeMethod = (typeof METHODS)[number];
