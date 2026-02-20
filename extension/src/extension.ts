import * as vscode from "vscode";
import WebSocket, { WebSocketServer } from "ws";
import { randomBytes } from "crypto";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import {
  BridgeErrorCode,
  JsonRpcRequest,
  JsonRpcResponse,
  METHODS,
  PROTOCOL_VERSION
} from "@ai-native/vscode-bridge-protocol";

const OUTPUT_CHANNEL_NAME = "VS Code Bridge";
const SECRET_TOKEN_KEY = "bridge.sessionToken";

function randomToken(): string {
  // Good enough for localhost pairing; stored in SecretStorage.
  return randomBytes(24).toString("hex");
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === "2.0" && typeof v.method === "string" && "id" in v;
}

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function err(
  id: JsonRpcRequest["id"],
  code: BridgeErrorCode,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data }
  };
}

function notify(method: string, params: unknown) {
  return { jsonrpc: "2.0", method, params };
}

function parseUri(uri: unknown): vscode.Uri | undefined {
  if (typeof uri !== "string") return undefined;
  try {
    return vscode.Uri.parse(uri);
  } catch {
    return undefined;
  }
}

function serializeRange(range: vscode.Range) {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character }
  };
}

function serializeDiagnostic(d: vscode.Diagnostic) {
  const code =
    d.code && typeof d.code === "object" && "value" in d.code
      ? (d.code as any).value
      : d.code ?? null;
  return {
    range: serializeRange(d.range),
    message: d.message,
    severity: d.severity,
    source: d.source ?? null,
    code
  };
}

function parsePosition(pos: unknown): vscode.Position | undefined {
  if (!pos || typeof pos !== "object") return undefined;
  const p = pos as any;
  if (typeof p.line !== "number" || typeof p.character !== "number") {
    return undefined;
  }
  return new vscode.Position(p.line, p.character);
}

function parseRange(r: unknown): vscode.Range | undefined {
  if (!r || typeof r !== "object") return undefined;
  const rr = r as any;
  const start = parsePosition(rr.start);
  const end = parsePosition(rr.end);
  if (!start || !end) return undefined;
  return new vscode.Range(start, end);
}

function serializeLocation(loc: vscode.Location) {
  return { uri: loc.uri.toString(), range: serializeRange(loc.range) };
}

function serializeLocationLink(link: vscode.LocationLink) {
  return {
    targetUri: link.targetUri.toString(),
    targetRange: serializeRange(link.targetRange),
    targetSelectionRange: link.targetSelectionRange
      ? serializeRange(link.targetSelectionRange)
      : null,
    originSelectionRange: link.originSelectionRange
      ? serializeRange(link.originSelectionRange)
      : null
  };
}

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  output.appendLine(`[bridge] activating (protocol=${PROTOCOL_VERSION})`);

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  status.text = "Bridge: starting…";
  status.show();
  context.subscriptions.push(status, output);

  const getConfig = () => vscode.workspace.getConfiguration();
  const canExecuteCommand = (command: string): { ok: true } | { ok: false; reason: string } => {
    const cfg = getConfig();
    const allow = cfg.get<string[]>("bridge.restrictions.commands.allow", []);
    const deny = cfg.get<string[]>("bridge.restrictions.commands.deny", []);

    if (deny.includes(command)) return { ok: false, reason: "Denied by settings" };
    if (allow.length > 0 && !allow.includes(command)) {
      return { ok: false, reason: "Not allowlisted by settings" };
    }
    return { ok: true };
  };

  let enabled = getConfig().get<boolean>("bridge.enabled", true);

  const token =
    (await context.secrets.get(SECRET_TOKEN_KEY)) ??
    (await (async () => {
      const t = randomToken();
      await context.secrets.store(SECRET_TOKEN_KEY, t);
      return t;
    })());

  const exportTokenIfConfigured = async () => {
    const raw = getConfig().get<string>("bridge.pairing.exportTokenPath", "");
    const exportPath = typeof raw === "string" ? raw.trim() : "";
    if (!exportPath) return;

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      output.appendLine(
        "[bridge] exportTokenPath set but no workspace folder is open"
      );
      return;
    }

    const workspaceFsPath = folder.uri.fsPath;
    const resolved = (() => {
      const substituted = exportPath.replace(
        /\$\{workspaceFolder\}/g,
        workspaceFsPath
      );
      return path.isAbsolute(substituted)
        ? substituted
        : path.join(workspaceFsPath, substituted);
    })();

    const rel = path.relative(workspaceFsPath, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      output.appendLine(
        `[bridge] warning: token export path is outside workspace: ${resolved}`
      );
    }

    try {
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, `${token}\n`, { mode: 0o600 });
      // Ensure perms even if file existed already.
      await chmod(resolved, 0o600);
      output.appendLine(`[bridge] exported token to ${resolved}`);
    } catch (e) {
      output.appendLine(
        `[bridge] failed to export token to ${resolved}: ${String(e)}`
      );
    }
  };

  await exportTokenIfConfigured();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bridge.pairing.exportTokenPath")) {
        void exportTokenIfConfigured();
      }
    })
  );

  const showTokenDisposable = vscode.commands.registerCommand(
    "vscode-bridge.showSessionToken",
    async () => {
      await vscode.window.showInformationMessage(`Bridge token: ${token}`);
    }
  );
  context.subscriptions.push(showTokenDisposable);

  const toggleDisposable = vscode.commands.registerCommand(
    "vscode-bridge.toggleEnabled",
    async () => {
      enabled = !enabled;
      await getConfig().update("bridge.enabled", enabled, true);
      output.appendLine(`[bridge] enabled=${enabled}`);
      status.text = enabled ? "Bridge: enabled" : "Bridge: disabled";
      if (!enabled) {
        await server?.stop();
        server = undefined;
      } else {
        server = await startServer();
      }
    }
  );
  context.subscriptions.push(toggleDisposable);

  const methods = new Set<string>(METHODS);
  const connected = new Set<WebSocket>();
  const diagSubscribers = new Set<WebSocket>();
  const debugSubscribers = new Set<WebSocket>();

  const broadcast = (msg: unknown, only?: Set<WebSocket>) => {
    const payload = JSON.stringify(msg);
    const targets = only ?? connected;
    for (const s of targets) {
      if (s.readyState === WebSocket.OPEN) s.send(payload);
    }
  };

  class BridgeServer {
    private wss: WebSocketServer;
    private port: number;

    constructor(wss: WebSocketServer, port: number) {
      this.wss = wss;
      this.port = port;
    }

    stop(): Promise<void> {
      return new Promise((resolve) => this.wss.close(() => resolve()));
    }

    info() {
      return { port: this.port };
    }
  }

  const startServer = async (): Promise<BridgeServer> => {
    const port = getConfig().get<number>("bridge.port", 57110);

    const wss = new WebSocketServer({ port, host: "127.0.0.1" });
    wss.on("listening", () => {
      const addr = wss.address();
      output.appendLine(
        `[bridge] listening ws://127.0.0.1:${port} (token shown via command)`
      );
      status.text = `Bridge: ws:${port}`;
      const where =
        addr && typeof addr !== "string"
          ? `${addr.address}:${addr.port}`
          : `127.0.0.1:${port}`;
      status.tooltip = `VS Code Bridge running on ${where}`;
    });

    wss.on("connection", (socket) => {
      output.appendLine("[bridge] client connected");
      connected.add(socket);

      socket.on("message", async (raw) => {
        let msg: unknown;
        try {
          msg = JSON.parse(raw.toString("utf8"));
        } catch {
          socket.send(
            JSON.stringify(err(null, "E_INVALID_PARAMS", "Invalid JSON"))
          );
          return;
        }

        if (!isJsonRpcRequest(msg)) {
          socket.send(
            JSON.stringify(err(null, "E_INVALID_PARAMS", "Not a JSON-RPC request"))
          );
          return;
        }

        const authToken = (msg.params as any)?.auth?.token;
        if (authToken !== token) {
          output.appendLine(`[bridge] E_AUTH for method=${msg.method}`);
          socket.send(
            JSON.stringify(err(msg.id, "E_AUTH", "Invalid or missing token"))
          );
          return;
        }

        const paramsForLog =
          msg.params && typeof msg.params === "object"
            ? { ...(msg.params as any), auth: { token: "***" } }
            : msg.params;
        output.appendLine(
          `[bridge] ${msg.method} ${paramsForLog != null ? JSON.stringify(paramsForLog).slice(0, 500) : ""}`
        );

        const send = (r: JsonRpcResponse) =>
          socket.send(JSON.stringify(r));

        try {
          switch (msg.method) {
            case "bridge.ping":
              send(ok(msg.id, { ok: true, protocol: PROTOCOL_VERSION }));
              return;
            case "bridge.capabilities":
              send(
                ok(msg.id, {
                  methods: [...methods],
                  events: [
                    "diagnostics.changed",
                    "tasks.exit",
                    "debug.sessionStarted",
                    "debug.sessionTerminated"
                  ],
                  limitations: [
                    "tasks.output not implemented yet (VS Code task output capture is limited)"
                  ]
                })
              );
              return;
            case "workspace.info": {
              send(
                ok(msg.id, {
                  folders:
                    vscode.workspace.workspaceFolders?.map((f) => ({
                      name: f.name,
                      uri: f.uri.toString()
                    })) ?? [],
                  name: vscode.workspace.name ?? null
                })
              );
              return;
            }
            case "diagnostics.list": {
              const uri = parseUri((msg.params as any)?.uri);
              if (uri) {
                send(
                  ok(msg.id, {
                    items: [
                      {
                        uri: uri.toString(),
                        diagnostics: vscode.languages
                          .getDiagnostics(uri)
                          .map(serializeDiagnostic)
                      }
                    ]
                  })
                );
                return;
              }

              const items = vscode.languages.getDiagnostics().map(([u, ds]) => ({
                uri: u.toString(),
                diagnostics: ds.map(serializeDiagnostic)
              }));
              send(ok(msg.id, { items }));
              return;
            }
            case "diagnostics.subscribe": {
              diagSubscribers.add(socket);
              send(ok(msg.id, { subscribed: true }));
              return;
            }
            case "doc.read": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const doc = await vscode.workspace.openTextDocument(uri);
              send(
                ok(msg.id, {
                  uri: uri.toString(),
                  version: doc.version,
                  languageId: doc.languageId,
                  text: doc.getText()
                })
              );
              return;
            }
            case "doc.applyEdits": {
              const uri = parseUri((msg.params as any)?.uri);
              const edits = (msg.params as any)?.edits;
              const expectedVersion = (msg.params as any)?.expectedVersion;
              if (!uri || !Array.isArray(edits)) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or edits")
                );
                return;
              }

              const doc = await vscode.workspace.openTextDocument(uri);
              if (
                typeof expectedVersion === "number" &&
                doc.version !== expectedVersion
              ) {
                send(
                  err(msg.id, "E_FAILED", "Document version mismatch", {
                    expectedVersion,
                    actualVersion: doc.version
                  })
                );
                return;
              }

              const we = new vscode.WorkspaceEdit();
              for (const e of edits) {
                const r = e?.range;
                const newText = e?.newText;
                if (
                  !r ||
                  typeof newText !== "string" ||
                  typeof r.start?.line !== "number" ||
                  typeof r.start?.character !== "number" ||
                  typeof r.end?.line !== "number" ||
                  typeof r.end?.character !== "number"
                ) {
                  send(err(msg.id, "E_INVALID_PARAMS", "Invalid edit shape"));
                  return;
                }
                we.replace(
                  uri,
                  new vscode.Range(
                    new vscode.Position(r.start.line, r.start.character),
                    new vscode.Position(r.end.line, r.end.character)
                  ),
                  newText
                );
              }

              const applied = await vscode.workspace.applyEdit(we);
              if (!applied) {
                send(err(msg.id, "E_FAILED", "Failed to apply edit"));
                return;
              }

              const doc2 = await vscode.workspace.openTextDocument(uri);
              send(ok(msg.id, { applied: true, newVersion: doc2.version }));
              return;
            }
            case "doc.format": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const doc = await vscode.workspace.openTextDocument(uri);
              const editorCfg = vscode.workspace.getConfiguration("editor", uri);
              const tabSize = editorCfg.get<number>("tabSize", 2);
              const insertSpaces = editorCfg.get<boolean>("insertSpaces", true);

              const edits =
                (await vscode.commands.executeCommand<vscode.TextEdit[]>(
                  "vscode.executeFormatDocumentProvider",
                  uri,
                  { tabSize, insertSpaces }
                )) ?? [];

              if (!edits.length) {
                send(ok(msg.id, { applied: false, editCount: 0 }));
                return;
              }

              const we = new vscode.WorkspaceEdit();
              for (const e of edits) we.replace(uri, e.range, e.newText);
              const applied = await vscode.workspace.applyEdit(we);
              send(ok(msg.id, { applied, editCount: edits.length }));
              return;
            }
            case "tasks.list": {
              const tasks = await vscode.tasks.fetchTasks();
              send(
                ok(msg.id, {
                  tasks: tasks.map((t) => ({
                    name: t.name,
                    source: t.source,
                    type: (t.definition as any)?.type ?? null
                  }))
                })
              );
              return;
            }
            case "tasks.run": {
              const name = (msg.params as any)?.name;
              if (typeof name !== "string" || !name.trim()) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid task name"));
                return;
              }

              const tasks = await vscode.tasks.fetchTasks();
              const task = tasks.find((t) => t.name === name);
              if (!task) {
                send(err(msg.id, "E_NOT_FOUND", "Task not found", { name }));
                return;
              }

              const execution = await vscode.tasks.executeTask(task);
              const taskId = randomBytes(8).toString("hex");
              runningTasks.set(taskId, execution);
              executionToId.set(execution, taskId);

              send(ok(msg.id, { taskId }));
              return;
            }
            case "tasks.terminate": {
              const taskId = (msg.params as any)?.taskId;
              if (typeof taskId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid taskId"));
                return;
              }
              const exec = runningTasks.get(taskId);
              if (!exec) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown taskId", { taskId }));
                return;
              }
              exec.terminate();
              send(ok(msg.id, { terminated: true }));
              return;
            }
            case "code.definitions": {
              const uri = parseUri((msg.params as any)?.uri);
              const pos = parsePosition((msg.params as any)?.position);
              if (!uri || !pos) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or position")
                );
                return;
              }

              const res =
                (await vscode.commands.executeCommand<
                  (vscode.Location | vscode.LocationLink)[]
                >("vscode.executeDefinitionProvider", uri, pos)) ?? [];

              const items = res.map((r) =>
                "targetUri" in (r as any)
                  ? serializeLocationLink(r as vscode.LocationLink)
                  : serializeLocation(r as vscode.Location)
              );

              send(ok(msg.id, { items }));
              return;
            }
            case "code.references": {
              const uri = parseUri((msg.params as any)?.uri);
              const pos = parsePosition((msg.params as any)?.position);
              const includeDeclaration =
                (msg.params as any)?.includeDeclaration ?? true;
              if (!uri || !pos) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or position")
                );
                return;
              }

              const res =
                (await vscode.commands.executeCommand<vscode.Location[]>(
                  "vscode.executeReferenceProvider",
                  uri,
                  pos
                )) ?? [];

              // VS Code API doesn't expose includeDeclaration for the generic command;
              // callers can filter results client-side if needed.
              send(
                ok(msg.id, {
                  includeDeclaration: Boolean(includeDeclaration),
                  items: res.map(serializeLocation)
                })
              );
              return;
            }
            case "code.symbols.document": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const res =
                (await vscode.commands.executeCommand<
                  (vscode.DocumentSymbol | vscode.SymbolInformation)[]
                >("vscode.executeDocumentSymbolProvider", uri)) ?? [];

              const items = res.map((s: any) => {
                if (s.location) {
                  return {
                    name: s.name,
                    kind: s.kind,
                    containerName: s.containerName ?? null,
                    location: serializeLocation(s.location)
                  };
                }
                return {
                  name: s.name,
                  kind: s.kind,
                  detail: s.detail ?? null,
                  range: serializeRange(s.range),
                  selectionRange: serializeRange(s.selectionRange),
                  children: Array.isArray(s.children) ? s.children.length : 0
                };
              });

              send(ok(msg.id, { items }));
              return;
            }
            case "code.symbols.workspace": {
              const query = (msg.params as any)?.query ?? "";
              if (typeof query !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid query"));
                return;
              }

              const res =
                (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                  "vscode.executeWorkspaceSymbolProvider",
                  query
                )) ?? [];
              send(
                ok(msg.id, {
                  items: res.map((s) => ({
                    name: s.name,
                    kind: s.kind,
                    containerName: s.containerName ?? null,
                    location: serializeLocation(s.location)
                  }))
                })
              );
              return;
            }
            case "code.hover": {
              const uri = parseUri((msg.params as any)?.uri);
              const pos = parsePosition((msg.params as any)?.position);
              if (!uri || !pos) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or position")
                );
                return;
              }

              const res =
                (await vscode.commands.executeCommand<vscode.Hover[]>(
                  "vscode.executeHoverProvider",
                  uri,
                  pos
                )) ?? [];

              const items = res.map((h) => ({
                range: h.range ? serializeRange(h.range) : null,
                contents: h.contents.map((c) =>
                  typeof c === "string"
                    ? c
                    : "value" in c
                      ? String((c as any).value)
                      : String(c)
                )
              }));

              send(ok(msg.id, { items }));
              return;
            }
            case "ui.openFile": {
              const uri = parseUri((msg.params as any)?.uri);
              const preview = (msg.params as any)?.preview ?? true;
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {
                preview: Boolean(preview)
              });
              send(ok(msg.id, { shown: true }));
              return;
            }
            case "ui.revealRange": {
              const uri = parseUri((msg.params as any)?.uri);
              const range = parseRange((msg.params as any)?.range);
              if (!uri || !range) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or range")
                );
                return;
              }
              const doc = await vscode.workspace.openTextDocument(uri);
              const editor = await vscode.window.showTextDocument(doc, {
                preview: true
              });
              editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
              send(ok(msg.id, { revealed: true }));
              return;
            }
            case "ui.focus": {
              const command = (msg.params as any)?.command;
              if (typeof command !== "string" || !command.trim()) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid command"));
                return;
              }
              const allowed = canExecuteCommand(command);
              if (!allowed.ok) {
                send(err(msg.id, "E_PERMISSION", "Command not permitted", { command, reason: allowed.reason }));
                return;
              }
              await vscode.commands.executeCommand(command);
              send(ok(msg.id, { focused: true }));
              return;
            }
            case "ui.openPanel": {
              const command = (msg.params as any)?.command;
              if (typeof command !== "string" || !command.trim()) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid command"));
                return;
              }
              const allowed = canExecuteCommand(command);
              if (!allowed.ok) {
                send(err(msg.id, "E_PERMISSION", "Command not permitted", { command, reason: allowed.reason }));
                return;
              }
              await vscode.commands.executeCommand(command);
              send(ok(msg.id, { opened: true }));
              return;
            }
            case "ui.quickPick": {
              const items = (msg.params as any)?.items;
              const placeholder = (msg.params as any)?.placeholder;
              if (!Array.isArray(items)) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid items"));
                return;
              }
              const qpItems = items.map((i) => ({
                label: String(i?.label ?? ""),
                description: i?.description != null ? String(i.description) : undefined,
                id: String(i?.id ?? "")
              }));
              const picked = await vscode.window.showQuickPick(qpItems, {
                placeHolder:
                  typeof placeholder === "string" ? placeholder : undefined
              });
              send(ok(msg.id, { pickedId: picked?.id ?? null }));
              return;
            }
            case "debug.sessions": {
              send(
                ok(msg.id, {
                  sessions: [...debugSessionById.values()].map((s) => ({
                    id: s.id,
                    name: s.name,
                    type: s.type
                  })),
                  activeSession: vscode.debug.activeDebugSession
                    ? {
                        id: vscode.debug.activeDebugSession.id,
                        name: vscode.debug.activeDebugSession.name,
                        type: vscode.debug.activeDebugSession.type
                      }
                    : null
                })
              );
              return;
            }
            case "debug.subscribe": {
              debugSubscribers.add(socket);
              send(ok(msg.id, { subscribed: true }));
              return;
            }
            case "debug.start": {
              const folderUri = parseUri((msg.params as any)?.folderUri);
              const configuration = (msg.params as any)?.configuration;
              if (!configuration || typeof configuration !== "object") {
                send(
                  err(
                    msg.id,
                    "E_INVALID_PARAMS",
                    "Missing/invalid configuration"
                  )
                );
                return;
              }

              const folder = folderUri
                ? vscode.workspace.getWorkspaceFolder(folderUri)
                : vscode.workspace.workspaceFolders?.[0];

              const started = await vscode.debug.startDebugging(
                folder,
                configuration as vscode.DebugConfiguration
              );
              send(ok(msg.id, { started }));
              return;
            }
            case "debug.stop": {
              const sessionId = (msg.params as any)?.sessionId;
              const session =
                typeof sessionId === "string"
                  ? debugSessionById.get(sessionId)
                  : vscode.debug.activeDebugSession;

              if (!session) {
                send(
                  err(msg.id, "E_NOT_FOUND", "No matching debug session", {
                    sessionId: sessionId ?? null
                  })
                );
                return;
              }

              const stopped = await vscode.debug.stopDebugging(session);
              send(ok(msg.id, { stopped }));
              return;
            }
            case "notebook.open": {
              const uri = parseUri((msg.params as any)?.uri);
              const show = (msg.params as any)?.show ?? false;
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const nb = await vscode.workspace.openNotebookDocument(uri);
              if (show) {
                await vscode.window.showNotebookDocument(nb, { preview: true });
              }
              send(
                ok(msg.id, {
                  uri: uri.toString(),
                  notebookType: nb.notebookType,
                  cellCount: nb.cellCount
                })
              );
              return;
            }
            case "notebook.read": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const nb = await vscode.workspace.openNotebookDocument(uri);
              send(
                ok(msg.id, {
                  uri: uri.toString(),
                  notebookType: nb.notebookType,
                  cells: nb
                    .getCells()
                    .map((c, index) => ({
                      index,
                      kind: c.kind,
                      languageId: c.document.languageId,
                      text: c.document.getText()
                    }))
                })
              );
              return;
            }
            case "notebook.executeCells": {
              const uri = parseUri((msg.params as any)?.uri);
              const start = (msg.params as any)?.start;
              const end = (msg.params as any)?.end;
              if (!uri || typeof start !== "number" || typeof end !== "number") {
                send(
                  err(
                    msg.id,
                    "E_INVALID_PARAMS",
                    "Missing/invalid uri, start, or end"
                  )
                );
                return;
              }
              const nb = await vscode.workspace.openNotebookDocument(uri);
              const editor = await vscode.window.showNotebookDocument(nb, {
                preview: true
              });
              editor.selections = [new vscode.NotebookRange(start, end)];
              await vscode.commands.executeCommand("notebook.cell.execute");
              send(ok(msg.id, { started: true }));
              return;
            }
            case "refactor.rename": {
              const uri = parseUri((msg.params as any)?.uri);
              const pos = parsePosition((msg.params as any)?.position);
              const newName = (msg.params as any)?.newName;
              if (!uri || !pos || typeof newName !== "string" || !newName.trim()) {
                send(
                  err(
                    msg.id,
                    "E_INVALID_PARAMS",
                    "Missing/invalid uri, position, or newName"
                  )
                );
                return;
              }

              const we =
                await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
                  "vscode.executeDocumentRenameProvider",
                  uri,
                  pos,
                  newName
                );
              if (!we) {
                send(err(msg.id, "E_UNSUPPORTED", "Rename provider unavailable"));
                return;
              }
              const applied = await vscode.workspace.applyEdit(we);
              if (!applied) {
                send(err(msg.id, "E_FAILED", "Failed to apply rename edit"));
                return;
              }
              send(ok(msg.id, { applied: true }));
              return;
            }
            case "refactor.organizeImports": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              const edits =
                (await vscode.commands.executeCommand<vscode.TextEdit[]>(
                  "vscode.executeOrganizeImports",
                  uri
                )) ?? [];
              if (!edits.length) {
                send(ok(msg.id, { applied: false, editCount: 0 }));
                return;
              }
              const we = new vscode.WorkspaceEdit();
              for (const e of edits) we.replace(uri, e.range, e.newText);
              const applied = await vscode.workspace.applyEdit(we);
              send(ok(msg.id, { applied, editCount: edits.length }));
              return;
            }
            case "refactor.codeActions": {
              const uri = parseUri((msg.params as any)?.uri);
              const range = parseRange((msg.params as any)?.range);
              const kind = (msg.params as any)?.kind;
              if (!uri || !range) {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri or range")
                );
                return;
              }
              if (kind != null && typeof kind !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid kind"));
                return;
              }

              const res =
                (await vscode.commands.executeCommand<
                  (vscode.CodeAction | vscode.Command)[]
                >("vscode.executeCodeActionProvider", uri, range, kind)) ?? [];

              const actions = res.map((a) => {
                const id = randomBytes(8).toString("hex");

                const looksLikeCodeAction = "edit" in (a as any) || "kind" in (a as any);
                const title = String((a as any).title ?? "");
                const ca = looksLikeCodeAction ? (a as vscode.CodeAction) : undefined;
                const cmd = looksLikeCodeAction
                  ? (ca?.command ?? undefined)
                  : (a as vscode.Command);

                actionById.set(id, {
                  title,
                  kind: ca?.kind?.value,
                  edit: ca?.edit,
                  command: cmd
                });
                actionOwner.set(id, socket);

                return {
                  id,
                  title,
                  kind: ca?.kind?.value ?? null,
                  hasEdit: Boolean(ca?.edit),
                  commandId: cmd?.command ?? null
                };
              });

              send(ok(msg.id, { actions }));
              return;
            }
            case "refactor.codeActions.apply": {
              const actionId = (msg.params as any)?.actionId;
              if (typeof actionId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid actionId"));
                return;
              }
              const action = actionById.get(actionId);
              if (!action) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown actionId", { actionId }));
                return;
              }

              let editApplied = false;
              if (action.edit) {
                editApplied = await vscode.workspace.applyEdit(action.edit);
                if (!editApplied) {
                  send(err(msg.id, "E_FAILED", "Failed to apply code action edit"));
                  return;
                }
              }

              let commandExecuted = false;
              if (action.command) {
                const allowed = canExecuteCommand(action.command.command);
                if (!allowed.ok) {
                  send(
                    err(msg.id, "E_PERMISSION", "Command not permitted", {
                      command: action.command.command,
                      reason: allowed.reason
                    })
                  );
                  return;
                }
                await vscode.commands.executeCommand(
                  action.command.command,
                  ...(action.command.arguments ?? [])
                );
                commandExecuted = true;
              }

              send(ok(msg.id, { applied: true, editApplied, commandExecuted }));
              return;
            }
            case "refactor.fixAll": {
              const uri = parseUri((msg.params as any)?.uri);
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }

              const doc = await vscode.workspace.openTextDocument(uri);
              const lastLine = Math.max(0, doc.lineCount - 1);
              const range = new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(lastLine, doc.lineAt(lastLine).text.length)
              );
              const kind = "source.fixAll";
              const res =
                (await vscode.commands.executeCommand<
                  (vscode.CodeAction | vscode.Command)[]
                >("vscode.executeCodeActionProvider", uri, range, kind)) ?? [];

              let editCount = 0;
              let commandCount = 0;
              for (const a of res) {
                const looksLikeCodeAction = "edit" in (a as any) || "kind" in (a as any);
                if (looksLikeCodeAction && (a as vscode.CodeAction).edit) {
                  const applied = await vscode.workspace.applyEdit(
                    (a as vscode.CodeAction).edit!
                  );
                  if (applied) editCount++;
                }
                const cmd = looksLikeCodeAction
                  ? (a as vscode.CodeAction).command
                  : (a as vscode.Command);
                if (cmd) {
                  const allowed = canExecuteCommand(cmd.command);
                  if (!allowed.ok) continue;
                  await vscode.commands.executeCommand(cmd.command, ...(cmd.arguments ?? []));
                  commandCount++;
                }
              }

              send(ok(msg.id, { editCount, commandCount }));
              return;
            }
            default:
              send(
                err(msg.id, "E_NOT_FOUND", "Unknown method", {
                  method: msg.method
                })
              );
              return;
          }
        } catch (e) {
          send(err(msg.id, "E_FAILED", String(e)));
          return;
        }
      });

      socket.on("close", () => {
        connected.delete(socket);
        diagSubscribers.delete(socket);
        debugSubscribers.delete(socket);
        for (const [id, owner] of actionOwner) {
          if (owner === socket) {
            actionOwner.delete(id);
            actionById.delete(id);
          }
        }
        output.appendLine("[bridge] client disconnected");
      });
      socket.on("error", (e) =>
        output.appendLine(`[bridge] socket error: ${String(e)}`)
      );
    });

    wss.on("error", (e) => {
      output.appendLine(`[bridge] server error: ${String(e)}`);
      status.text = "Bridge: error";
    });

    return new BridgeServer(wss, port);
  };

  const runningTasks = new Map<string, vscode.TaskExecution>();
  const executionToId = new Map<vscode.TaskExecution, string>();
  const debugSessionById = new Map<string, vscode.DebugSession>();
  const actionById = new Map<
    string,
    { edit?: vscode.WorkspaceEdit; command?: vscode.Command; title: string; kind?: string }
  >();
  const actionOwner = new Map<string, WebSocket>();

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      if (!diagSubscribers.size) return;
      for (const uri of e.uris) {
        broadcast(notify("diagnostics.changed", { uri: uri.toString() }), diagSubscribers);
      }
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      const taskId = executionToId.get(e.execution);
      if (!taskId) return;
      broadcast(
        notify("tasks.exit", {
          taskId,
          exitCode: e.exitCode ?? null
        })
      );
      executionToId.delete(e.execution);
      runningTasks.delete(taskId);
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((s) => {
      debugSessionById.set(s.id, s);
      if (!debugSubscribers.size) return;
      broadcast(
        notify("debug.sessionStarted", {
          id: s.id,
          name: s.name,
          type: s.type
        }),
        debugSubscribers
      );
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession((s) => {
      debugSessionById.delete(s.id);
      if (!debugSubscribers.size) return;
      broadcast(
        notify("debug.sessionTerminated", {
          id: s.id,
          name: s.name,
          type: s.type
        }),
        debugSubscribers
      );
    })
  );

  let server: BridgeServer | undefined;
  if (enabled) {
    server = await startServer();
  } else {
    status.text = "Bridge: disabled";
  }

  context.subscriptions.push(
    new vscode.Disposable(() => {
      void server?.stop();
    })
  );
}

export function deactivate() {
  // VS Code disposes subscriptions on shutdown.
}
