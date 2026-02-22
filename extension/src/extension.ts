import * as vscode from "vscode";
import WebSocket, { WebSocketServer } from "ws";
import { randomBytes } from "crypto";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { createTwoFilesPatch } from "diff";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  BridgeErrorCode,
  JsonRpcRequest,
  JsonRpcResponse,
  METHODS,
  PROTOCOL_VERSION
} from "@ai-native/vscode-bridge-protocol";
import { TraceBuffer, TraceTreeProvider } from "./traceView";

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

type TxStagedDoc = {
  uri: vscode.Uri;
  baseVersion: number;
  baseText: string;
  newText: string;
  editCount: number;
};

type Tx = {
  id: string;
  createdAt: number;
  staged: Map<string, TxStagedDoc>;
};

function applyTextEdits(
  doc: vscode.TextDocument,
  baseText: string,
  edits: Array<{ range: any; newText: any }>
): string {
  const normalized = edits.map((e) => {
    const r = e?.range;
    if (
      !r ||
      typeof e?.newText !== "string" ||
      typeof r.start?.line !== "number" ||
      typeof r.start?.character !== "number" ||
      typeof r.end?.line !== "number" ||
      typeof r.end?.character !== "number"
    ) {
      throw new Error("Invalid edit shape");
    }
    const start = doc.offsetAt(
      new vscode.Position(r.start.line, r.start.character)
    );
    const end = doc.offsetAt(new vscode.Position(r.end.line, r.end.character));
    return { start, end, newText: e.newText as string };
  });

  // Apply from end to start to keep offsets stable.
  normalized.sort((a, b) => b.start - a.start);
  let text = baseText;
  for (const e of normalized) {
    text = text.slice(0, e.start) + e.newText + text.slice(e.end);
  }
  return text;
}

function fullDocumentRange(doc: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(0, doc.lineCount - 1);
  const endChar = doc.lineAt(lastLine).text.length;
  return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, endChar));
}

function unifiedDiffForDoc(
  uri: vscode.Uri,
  baseText: string,
  newText: string
): string {
  const fileLabel = vscode.workspace.asRelativePath(uri, false);
  return createTwoFilesPatch(fileLabel, fileLabel, baseText, newText, "base", "staged", {
    context: 3
  });
}

export async function activate(context: vscode.ExtensionContext) {
  const execFileAsync = promisify(execFile);
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  output.appendLine(`[bridge] activating (protocol=${PROTOCOL_VERSION})`);

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  status.text = "Bridge: starting…";
  status.show();
  context.subscriptions.push(status, output);

  const getConfig = () => vscode.workspace.getConfiguration();
  const traceEnabled = () => getConfig().get<boolean>("bridge.trace.enabled", true);
  const trace = new TraceBuffer(200);
  const traceProvider = new TraceTreeProvider(trace);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("vscode-bridge.traceView", traceProvider)
  );
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

  const openTraceDisposable = vscode.commands.registerCommand(
    "vscode-bridge.openTrace",
    async () => {
      await vscode.commands.executeCommand("vscode-bridge.traceView.focus");
    }
  );
  context.subscriptions.push(openTraceDisposable);

  const methods = new Set<string>(METHODS);
  const connected = new Set<WebSocket>();
  const diagSubscribers = new Set<WebSocket>();
  const debugSubscribers = new Set<WebSocket>();
  const txById = new Map<string, Tx>();
  const snapshotById = new Map<string, { kind: "git-stash"; cwd: string; stashRef: string }>();

  type EventSub = {
    id: string;
    socket: WebSocket;
    filter: Set<string> | null; // null = all events
  };

  const eventSubsById = new Map<string, EventSub>();
  const eventSubsBySocket = new Map<WebSocket, Set<string>>();
  const eventBuffer: Array<{ seq: number; ts: number; name: string; params: unknown }> = [];
  let eventSeq = 0;
  const EVENT_BUFFER_MAX = 200;

  const emitEvent = (name: string, params: unknown) => {
    const ev = { seq: ++eventSeq, ts: Date.now(), name, params };
    eventBuffer.push(ev);
    while (eventBuffer.length > EVENT_BUFFER_MAX) eventBuffer.shift();

    const payload = JSON.stringify(
      notify("events.notification", {
        ...ev
      })
    );

    for (const sub of eventSubsById.values()) {
      if (sub.socket.readyState !== WebSocket.OPEN) continue;
      if (sub.filter && !sub.filter.has(name)) continue;
      sub.socket.send(payload);
    }

    if (traceEnabled()) {
      trace.push({
        ts: ev.ts,
        kind: "event",
        name,
        summary: "",
        data: params
      });
    }
  };

  const getWorkspaceFolderFsPath = (): string | null => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder?.uri.fsPath ?? null;
  };

  const runGit = async (cwd: string, args: string[]) => {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd });
    const out = String(stdout ?? "").trim();
    const errText = String(stderr ?? "").trim();
    return { out, errText };
  };

  const stageWorkspaceEdit = async (
    tx: Tx,
    we: vscode.WorkspaceEdit
  ): Promise<TxStagedDoc[]> => {
    const stagedDocs: TxStagedDoc[] = [];
    for (const [uri, edits] of we.entries()) {
      if (!Array.isArray(edits) || edits.length === 0) continue;
      const doc = await vscode.workspace.openTextDocument(uri);
      const baseText = doc.getText();
      const newText = applyTextEdits(
        doc,
        baseText,
        edits.map((e) => ({ range: e.range, newText: e.newText }))
      );
      const staged: TxStagedDoc = {
        uri,
        baseVersion: doc.version,
        baseText,
        newText,
        editCount: edits.length
      };
      tx.staged.set(uri.toString(), staged);
      stagedDocs.push(staged);
    }
    return stagedDocs;
  };

  const commitTx = async (
    txId: string
  ): Promise<{ ok: true; result: any } | { ok: false; error: JsonRpcResponse }> => {
    const tx = txById.get(txId);
    if (!tx) {
      return { ok: false, error: err(null, "E_NOT_FOUND", "Unknown txId", { txId }) };
    }

    // Validate base versions before applying any edits.
    for (const s of tx.staged.values()) {
      const doc = await vscode.workspace.openTextDocument(s.uri);
      if (doc.version !== s.baseVersion) {
        return {
          ok: false,
          error: err(null, "E_FAILED", "Document version mismatch", {
            uri: s.uri.toString(),
            expectedVersion: s.baseVersion,
            actualVersion: doc.version
          })
        };
      }
    }

    const we = new vscode.WorkspaceEdit();
    for (const s of tx.staged.values()) {
      const doc = await vscode.workspace.openTextDocument(s.uri);
      we.replace(s.uri, fullDocumentRange(doc), s.newText);
    }

    const applied = await vscode.workspace.applyEdit(we);
    if (!applied) {
      return { ok: false, error: err(null, "E_FAILED", "Failed to apply transaction") };
    }

    txById.delete(txId);
    return { ok: true, result: { txId, committed: true, fileCount: we.size } };
  };

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
        if (traceEnabled()) {
          trace.push({
            ts: Date.now(),
            kind: "rpc",
            name: msg.method,
            summary: "",
            data: paramsForLog
          });
        }

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
                    "debug.sessionTerminated",
                    "events.notification"
                  ],
                  limitations: [
                    "tasks.output not implemented yet (VS Code task output capture is limited)"
                  ]
                })
              );
              return;
            case "events.subscribe": {
              const events = (msg.params as any)?.events;
              const replay = (msg.params as any)?.replay ?? 0;
              if (events != null && !Array.isArray(events)) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid events filter"));
                return;
              }
              if (typeof replay !== "number" || replay < 0 || replay > EVENT_BUFFER_MAX) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid replay value"));
                return;
              }
              const subId = randomBytes(8).toString("hex");
              const filter =
                Array.isArray(events) && events.length > 0
                  ? new Set(events.map((e) => String(e)))
                  : null;
              const sub: EventSub = { id: subId, socket, filter };
              eventSubsById.set(subId, sub);
              if (!eventSubsBySocket.has(socket)) eventSubsBySocket.set(socket, new Set());
              eventSubsBySocket.get(socket)!.add(subId);

              // Replay last N matching events as notifications.
              if (replay > 0) {
                const slice = eventBuffer.slice(-replay);
                for (const ev of slice) {
                  if (filter && !filter.has(ev.name)) continue;
                  socket.send(JSON.stringify(notify("events.notification", ev)));
                }
              }

              send(
                ok(msg.id, {
                  subscriptionId: subId,
                  filter: filter ? [...filter] : null,
                  replayed: replay
                })
              );
              return;
            }
            case "events.unsubscribe": {
              const subscriptionId = (msg.params as any)?.subscriptionId;
              if (typeof subscriptionId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid subscriptionId"));
                return;
              }
              const sub = eventSubsById.get(subscriptionId);
              if (!sub) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown subscriptionId", { subscriptionId }));
                return;
              }
              if (sub.socket !== socket) {
                send(err(msg.id, "E_PERMISSION", "Subscription owned by different connection"));
                return;
              }
              eventSubsById.delete(subscriptionId);
              eventSubsBySocket.get(socket)?.delete(subscriptionId);
              send(ok(msg.id, { unsubscribed: true }));
              return;
            }
            case "agent.suggestNextSteps": {
              const goal = (msg.params as any)?.goal;
              const maxSuggestions = (msg.params as any)?.maxSuggestions ?? 8;
              if (goal != null && typeof goal !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid goal"));
                return;
              }
              if (
                typeof maxSuggestions !== "number" ||
                maxSuggestions < 1 ||
                maxSuggestions > 25
              ) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid maxSuggestions"));
                return;
              }

              const diags = vscode.languages.getDiagnostics();
              const firstWithDiag = diags.find(([, ds]) => ds.length > 0)?.[0];

              const suggestions: Array<any> = [];

              suggestions.push({
                id: "capabilities",
                title: "Re-check bridge capabilities",
                rationale: "Always start truth-seeking: ensure method surface matches expectations.",
                method: "bridge.capabilities",
                params: {}
              });

              suggestions.push({
                id: "doctor",
                title: "Run doctor",
                rationale: "Verify code CLI, extension install, token export, and bridge reachability.",
                method: "client.doctor",
                params: {}
              });

              if (firstWithDiag) {
                suggestions.push({
                  id: "fix-diagnostics",
                  title: "Fix diagnostics via code actions (transactional)",
                  rationale:
                    "Use VS Code as kernel: stage quickfix code actions into a tx, preview diff, then commit or rollback.",
                  method: "agent.planAndExecute",
                  params: {
                    goal: "Fix diagnostics using code actions",
                    dryRun: true
                  }
                });
              } else {
                suggestions.push({
                  id: "run-task",
                  title: "Run a task to get ground truth",
                  rationale:
                    "If no diagnostics are present, drive truth from an executable task (tests/build).",
                  method: "tasks.list",
                  params: {}
                });
              }

              send(ok(msg.id, { suggestions: suggestions.slice(0, maxSuggestions) }));
              return;
            }
            case "agent.planAndExecute": {
              const goal = (msg.params as any)?.goal;
              const dryRun = (msg.params as any)?.dryRun ?? true;
              const maxSteps = (msg.params as any)?.maxSteps ?? 10;
              if (typeof goal !== "string" || !goal.trim()) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid goal"));
                return;
              }
              if (typeof dryRun !== "boolean") {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid dryRun"));
                return;
              }
              if (typeof maxSteps !== "number" || maxSteps < 1 || maxSteps > 25) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid maxSteps"));
                return;
              }

              // TRACE: Trace — agent started
              if (traceEnabled()) {
                trace.push({
                  ts: Date.now(),
                  kind: "agent-step",
                  name: "agent.planAndExecute",
                  summary: `Goal: "${goal}" (dry-run: ${dryRun})`,
                  status: "pending"
                });
              }

              // DIAGNOSTICS: Capture diagnostics before for delta
              const diagCountBefore = vscode.languages
                .getDiagnostics()
                .reduce((sum, [, ds]) => sum + ds.length, 0);

              const steps: any[] = [];

              // Start a tx.
              const txId = randomBytes(8).toString("hex");
              txById.set(txId, { id: txId, createdAt: Date.now(), staged: new Map() });
              steps.push({ kind: "tx.begin", txId });

              if (traceEnabled()) {
                trace.push({ ts: Date.now(), kind: "tx", name: "tx.begin", summary: `txId: ${txId}` });
              }

              // Minimal policy: if diagnostics exist, try a quickfix stage on the first file.
              const all = vscode.languages.getDiagnostics();
              const firstWithDiag = all.find(([, ds]) => ds.length > 0)?.[0] ?? null;
              if (firstWithDiag) {
                const tx = txById.get(txId)!;
                const uri = firstWithDiag;
                const doc = await vscode.workspace.openTextDocument(uri);
                const range = fullDocumentRange(doc);
                const actions =
                  (await vscode.commands.executeCommand<
                    (vscode.CodeAction | vscode.Command)[]
                  >("vscode.executeCodeActionProvider", uri, range, "quickfix")) ?? [];
                const first = actions.find(
                  (a: any) => a && typeof a === "object" && "edit" in a && (a as any).edit
                ) as vscode.CodeAction | undefined;

                if (first?.edit) {
                  const stagedDocs = await stageWorkspaceEdit(tx, first.edit);
                  steps.push({
                    kind: "diagnostics.fix.preview",
                    uri: uri.toString(),
                    title: first.title,
                    stagedFiles: stagedDocs.map((s) => s.uri.toString())
                  });
                  if (traceEnabled()) {
                    trace.push({
                      ts: Date.now(), kind: "agent-step", name: "diagnostics.fix.preview",
                      summary: `${first.title} on ${uri.toString().split("/").pop()}`
                    });
                  }
                } else {
                  steps.push({
                    kind: "diagnostics.fix.preview",
                    uri: uri.toString(),
                    staged: false,
                    reason: "No quickfix edits available"
                  });
                }
              } else {
                steps.push({
                  kind: "noop",
                  reason: "No diagnostics found; no default plan for goal yet",
                  goal
                });
              }

              // Preview.
              const tx = txById.get(txId)!;
              const previewFiles = [...tx.staged.values()].map((s) =>
                unifiedDiffForDoc(s.uri, s.baseText, s.newText)
              );
              const previewUnifiedDiff = previewFiles.join("\n");
              steps.push({ kind: "tx.preview", fileCount: tx.staged.size });

              let committed = false;
              let rolledBack = false;
              if (dryRun) {
                txById.delete(txId);
                rolledBack = true;
                steps.push({ kind: "tx.rollback" });
                if (traceEnabled()) {
                  trace.push({ ts: Date.now(), kind: "tx", name: "tx.rollback", summary: `dry-run rollback` });
                }
              } else {
                const committedRes = await commitTx(txId);
                if (!committedRes.ok) {
                  if (traceEnabled()) {
                    trace.updateLast(
                      (i) => i.kind === "agent-step" && i.name === "agent.planAndExecute",
                      { status: "error", summary: `Failed: ${(committedRes.error as any)?.message ?? "unknown"}` }
                    );
                  }
                  send({ ...(committedRes.error as any), id: msg.id });
                  return;
                }
                committed = true;
                steps.push({ kind: "tx.commit" });
                if (traceEnabled()) {
                  trace.push({ ts: Date.now(), kind: "tx", name: "tx.commit", summary: `${tx.staged.size} file(s)` });
                }
              }

              // DIAGNOSTICS: Diagnostics delta
              const diagCountAfter = vscode.languages
                .getDiagnostics()
                .reduce((sum, [, ds]) => sum + ds.length, 0);

              // TRACE: Trace — agent complete
              if (traceEnabled()) {
                trace.updateLast(
                  (i) => i.kind === "agent-step" && i.name === "agent.planAndExecute",
                  {
                    status: committed ? "success" : "pending",
                    summary: `${committed ? "Committed" : "Dry-run"}: ${tx.staged.size} file(s), diag Δ ${diagCountAfter - diagCountBefore}`
                  }
                );
                if (diagCountBefore !== diagCountAfter) {
                  trace.push({
                    ts: Date.now(), kind: "diagnostics", name: "diagnostics.delta",
                    summary: `${diagCountBefore} → ${diagCountAfter} (Δ ${diagCountAfter - diagCountBefore})`
                  });
                }
              }

              send(
                ok(msg.id, {
                  goal,
                  dryRun,
                  txId: dryRun ? null : txId,
                  steps: steps.slice(0, maxSteps),
                  previewUnifiedDiff,
                  committed,
                  rolledBack,
                  diagnosticsDelta: {
                    before: diagCountBefore,
                    after: diagCountAfter,
                    delta: diagCountAfter - diagCountBefore
                  }
                })
              );
              return;
            }
            case "tx.begin": {
              const txId = randomBytes(8).toString("hex");
              const tx: Tx = { id: txId, createdAt: Date.now(), staged: new Map() };
              txById.set(txId, tx);
              send(ok(msg.id, { txId, createdAt: tx.createdAt }));
              return;
            }
            case "tx.snapshot.create": {
              const workspace = getWorkspaceFolderFsPath();
              if (!workspace) {
                send(err(msg.id, "E_FAILED", "No workspace folder is open"));
                return;
              }

              try {
                await runGit(workspace, ["rev-parse", "--is-inside-work-tree"]);
              } catch (e) {
                send(
                  err(
                    msg.id,
                    "E_UNSUPPORTED",
                    "Git snapshot requires a git workspace",
                    { workspace }
                  )
                );
                return;
              }

              const snapshotId = randomBytes(8).toString("hex");
              const message = `bridge-snapshot:${snapshotId}`;

              try {
                // Create stash without changing final working tree: push (cleans) + apply (restores).
                await runGit(workspace, ["stash", "push", "-u", "-m", message]);
                const { out: stashRef } = await runGit(workspace, [
                  "stash",
                  "list",
                  "-n",
                  "1",
                  "--pretty=format:%gd"
                ]);
                if (!stashRef) {
                  send(err(msg.id, "E_FAILED", "Failed to resolve stash ref"));
                  return;
                }
                await runGit(workspace, ["stash", "apply", stashRef]);
                snapshotById.set(snapshotId, {
                  kind: "git-stash",
                  cwd: workspace,
                  stashRef
                });

                send(ok(msg.id, { snapshotId, kind: "git-stash", stashRef }));
                return;
              } catch (e) {
                send(err(msg.id, "E_FAILED", String(e)));
                return;
              }
            }
            case "tx.snapshot.restore": {
              const snapshotId = (msg.params as any)?.snapshotId;
              const dangerouslyDiscardLocalChanges = (msg.params as any)
                ?.dangerouslyDiscardLocalChanges;

              if (typeof snapshotId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid snapshotId"));
                return;
              }
              if (dangerouslyDiscardLocalChanges !== true) {
                send(
                  err(
                    msg.id,
                    "E_PERMISSION",
                    "Refusing to restore snapshot without dangerouslyDiscardLocalChanges=true",
                    { snapshotId }
                  )
                );
                return;
              }

              const snap = snapshotById.get(snapshotId);
              if (!snap) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown snapshotId", { snapshotId }));
                return;
              }
              if (snap.kind !== "git-stash") {
                send(err(msg.id, "E_UNSUPPORTED", "Unsupported snapshot kind"));
                return;
              }

              try {
                // Discard current working changes then apply snapshot.
                await runGit(snap.cwd, ["checkout", "--", "."]);
                await runGit(snap.cwd, ["clean", "-fd"]);
                await runGit(snap.cwd, ["stash", "apply", snap.stashRef]);
                send(ok(msg.id, { snapshotId, restored: true }));
                return;
              } catch (e) {
                send(err(msg.id, "E_FAILED", String(e)));
                return;
              }
            }
            case "tx.preview": {
              const txId = (msg.params as any)?.txId;
              if (typeof txId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId"));
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
                return;
              }
              const files = [...tx.staged.values()].map((s) => ({
                uri: s.uri.toString(),
                editCount: s.editCount,
                unifiedDiff: unifiedDiffForDoc(s.uri, s.baseText, s.newText)
              }));
              send(
                ok(msg.id, {
                  txId,
                  fileCount: files.length,
                  unifiedDiff: files.map((f) => f.unifiedDiff).join("\n"),
                  files
                })
              );
              return;
            }
            case "tx.commit": {
              const txId = (msg.params as any)?.txId;
              if (typeof txId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId"));
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
                return;
              }

              // Validate base versions before applying any edits.
              for (const s of tx.staged.values()) {
                const doc = await vscode.workspace.openTextDocument(s.uri);
                if (doc.version !== s.baseVersion) {
                  send(
                    err(msg.id, "E_FAILED", "Document version mismatch", {
                      uri: s.uri.toString(),
                      expectedVersion: s.baseVersion,
                      actualVersion: doc.version
                    })
                  );
                  return;
                }
              }

              const we = new vscode.WorkspaceEdit();
              for (const s of tx.staged.values()) {
                const doc = await vscode.workspace.openTextDocument(s.uri);
                we.replace(s.uri, fullDocumentRange(doc), s.newText);
              }

              const applied = await vscode.workspace.applyEdit(we);
              if (!applied) {
                send(err(msg.id, "E_FAILED", "Failed to apply transaction"));
                return;
              }

              txById.delete(txId);
              send(ok(msg.id, { txId, committed: true, fileCount: we.size }));
              return;
            }
            case "tx.rollback": {
              const txId = (msg.params as any)?.txId;
              if (typeof txId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId"));
                return;
              }
              const existed = txById.delete(txId);
              send(ok(msg.id, { txId, rolledBack: existed }));
              return;
            }
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
            case "diagnostics.fix.preview": {
              const txId = (msg.params as any)?.txId;
              const uri = parseUri((msg.params as any)?.uri);
              const kind = (msg.params as any)?.kind ?? "quickfix";
              if (typeof txId !== "string" || !uri || typeof kind !== "string") {
                send(
                  err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId, uri, or kind")
                );
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
                return;
              }

              const doc = await vscode.workspace.openTextDocument(uri);
              const range = fullDocumentRange(doc);
              const actions =
                (await vscode.commands.executeCommand<
                  (vscode.CodeAction | vscode.Command)[]
                >("vscode.executeCodeActionProvider", uri, range, kind)) ?? [];

              const first = actions.find(
                (a: any) => a && typeof a === "object" && "edit" in a && (a as any).edit
              ) as vscode.CodeAction | undefined;

              if (!first?.edit) {
                send(
                  ok(msg.id, {
                    txId,
                    staged: false,
                    reason: "No code action edits available"
                  })
                );
                return;
              }

              let stagedDocs: TxStagedDoc[];
              try {
                stagedDocs = await stageWorkspaceEdit(tx, first.edit);
              } catch (e) {
                send(err(msg.id, "E_FAILED", String(e)));
                return;
              }

              send(
                ok(msg.id, {
                  txId,
                  staged: true,
                  title: first.title,
                  kind: first.kind?.value ?? null,
                  files: stagedDocs.map((s) => ({
                    uri: s.uri.toString(),
                    editCount: s.editCount,
                    unifiedDiff: unifiedDiffForDoc(s.uri, s.baseText, s.newText)
                  })),
                  unifiedDiff: stagedDocs
                    .map((s) => unifiedDiffForDoc(s.uri, s.baseText, s.newText))
                    .join("\n")
                })
              );
              return;
            }
            case "diagnostics.fix.commit": {
              const txId = (msg.params as any)?.txId;
              if (typeof txId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId"));
                return;
              }
              const committed = await commitTx(txId);
              if (!committed.ok) {
                send({ ...(committed.error as any), id: msg.id });
                return;
              }
              send(ok(msg.id, committed.result));
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
            case "doc.applyEdits.preview": {
              const txId = (msg.params as any)?.txId;
              const uri = parseUri((msg.params as any)?.uri);
              const edits = (msg.params as any)?.edits;
              if (typeof txId !== "string" || !uri || !Array.isArray(edits)) {
                send(
                  err(
                    msg.id,
                    "E_INVALID_PARAMS",
                    "Missing/invalid txId, uri, or edits"
                  )
                );
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
                return;
              }

              const doc = await vscode.workspace.openTextDocument(uri);
              const baseText = doc.getText();
              let newText: string;
              try {
                newText = applyTextEdits(doc, baseText, edits);
              } catch (e) {
                send(err(msg.id, "E_INVALID_PARAMS", String(e)));
                return;
              }

              const staged: TxStagedDoc = {
                uri,
                baseVersion: doc.version,
                baseText,
                newText,
                editCount: edits.length
              };
              tx.staged.set(uri.toString(), staged);

              send(
                ok(msg.id, {
                  txId,
                  uri: uri.toString(),
                  editCount: staged.editCount,
                  unifiedDiff: unifiedDiffForDoc(uri, baseText, newText),
                  impactAnalysis: {
                    touchedFiles: 1,
                    estimatedRisk: "unknown"
                  }
                })
              );
              return;
            }
            case "doc.applyEdits.commit": {
              const txId = (msg.params as any)?.txId;
              const uri = parseUri((msg.params as any)?.uri);
              if (typeof txId !== "string" || !uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId or uri"));
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
                return;
              }
              const staged = tx.staged.get(uri.toString());
              if (!staged) {
                send(err(msg.id, "E_NOT_FOUND", "No staged edits for uri", { uri: uri.toString() }));
                return;
              }

              const doc = await vscode.workspace.openTextDocument(uri);
              if (doc.version !== staged.baseVersion) {
                send(
                  err(msg.id, "E_FAILED", "Document version mismatch", {
                    uri: uri.toString(),
                    expectedVersion: staged.baseVersion,
                    actualVersion: doc.version
                  })
                );
                return;
              }

              const we = new vscode.WorkspaceEdit();
              we.replace(uri, fullDocumentRange(doc), staged.newText);
              const applied = await vscode.workspace.applyEdit(we);
              if (!applied) {
                send(err(msg.id, "E_FAILED", "Failed to apply edit"));
                return;
              }

              // Remove only this doc from the tx; tx can continue staging other docs.
              tx.staged.delete(uri.toString());
              const doc2 = await vscode.workspace.openTextDocument(uri);
              send(ok(msg.id, { txId, applied: true, newVersion: doc2.version }));
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
            case "tasks.run.capture": {
              const name = (msg.params as any)?.name;
              const timeoutMs = (msg.params as any)?.timeoutMs ?? 120000;
              if (typeof name !== "string" || !name.trim()) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid task name"));
                return;
              }
              if (typeof timeoutMs !== "number" || timeoutMs <= 0) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid timeoutMs"));
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

              const exitCode = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => resolve(null), timeoutMs);
                taskCaptureWaiter.set(taskId, (code) => {
                  clearTimeout(timer);
                  resolve(code);
                });
              });

              send(
                ok(msg.id, {
                  taskId,
                  exitCode,
                  output: null,
                  failureSummary: null,
                  limitations: [
                    "tasks.run.capture currently cannot reliably capture stdout/stderr from VS Code tasks"
                  ]
                })
              );
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
            case "refactor.rename.preview": {
              const txId = (msg.params as any)?.txId;
              const uri = parseUri((msg.params as any)?.uri);
              const pos = parsePosition((msg.params as any)?.position);
              const newName = (msg.params as any)?.newName;
              if (
                typeof txId !== "string" ||
                !uri ||
                !pos ||
                typeof newName !== "string" ||
                !newName.trim()
              ) {
                send(
                  err(
                    msg.id,
                    "E_INVALID_PARAMS",
                    "Missing/invalid txId, uri, position, or newName"
                  )
                );
                return;
              }
              const tx = txById.get(txId);
              if (!tx) {
                send(err(msg.id, "E_NOT_FOUND", "Unknown txId", { txId }));
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

              const stagedDocs = await stageWorkspaceEdit(tx, we);
              send(
                ok(msg.id, {
                  txId,
                  staged: true,
                  files: stagedDocs.map((s) => ({
                    uri: s.uri.toString(),
                    editCount: s.editCount,
                    unifiedDiff: unifiedDiffForDoc(s.uri, s.baseText, s.newText)
                  })),
                  unifiedDiff: stagedDocs
                    .map((s) => unifiedDiffForDoc(s.uri, s.baseText, s.newText))
                    .join("\n")
                })
              );
              return;
            }
            case "refactor.rename.commit": {
              const txId = (msg.params as any)?.txId;
              if (typeof txId !== "string") {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid txId"));
                return;
              }
              const committed = await commitTx(txId);
              if (!committed.ok) {
                send({ ...(committed.error as any), id: msg.id });
                return;
              }
              send(ok(msg.id, committed.result));
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
            case "symbols.deepContext": {
              const uri = parseUri((msg.params as any)?.uri);
              const maxDepth = (msg.params as any)?.maxDepth ?? 1;
              const includeBlame = (msg.params as any)?.includeBlame ?? true;
              if (!uri) {
                send(err(msg.id, "E_INVALID_PARAMS", "Missing/invalid uri"));
                return;
              }
              if (typeof maxDepth !== "number" || maxDepth < 0 || maxDepth > 5) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid maxDepth (0-5)"));
                return;
              }

              // 1. Document symbols
              const docSymbols =
                (await vscode.commands.executeCommand<
                  (vscode.DocumentSymbol | vscode.SymbolInformation)[]
                >("vscode.executeDocumentSymbolProvider", uri)) ?? [];

              const serializeSym = (s: any): any => {
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
                  children: Array.isArray(s.children)
                    ? s.children.map(serializeSym)
                    : []
                };
              };

              const symbols = docSymbols.map(serializeSym);

              // 2. Call graph: for each symbol with a selectionRange, resolve definitions/references
              const callGraph: any[] = [];
              if (maxDepth > 0) {
                const flatSymbols = docSymbols.filter(
                  (s: any) => s.selectionRange
                ) as vscode.DocumentSymbol[];

                // Limit to 50 symbols to prevent performance bottleneck during reference resolution
                for (const sym of flatSymbols.slice(0, 50)) {
                  const midPos = new vscode.Position(
                    sym.selectionRange.start.line,
                    sym.selectionRange.start.character
                  );

                  const refs =
                    (await vscode.commands.executeCommand<vscode.Location[]>(
                      "vscode.executeReferenceProvider",
                      uri,
                      midPos
                    )) ?? [];

                  if (refs.length > 0) {
                    callGraph.push({
                      from: {
                        name: sym.name,
                        kind: sym.kind,
                        range: serializeRange(sym.selectionRange)
                      },
                      // Cap references per symbol at 20 to restrict payload size
                      to: refs.slice(0, 20).map(serializeLocation)
                    });
                  }
                }
              }

              // 3. Git blame
              let blame: any[] | null = null;
              if (includeBlame) {
                const workspace = getWorkspaceFolderFsPath();
                if (workspace) {
                  try {
                    const relPath = uri.fsPath.replace(workspace + "/", "");
                    const { out } = await runGit(workspace, [
                      "blame",
                      "--porcelain",
                      relPath
                    ]);
                    // Parse porcelain blame into structured entries
                    const lines = out.split("\n");
                    const entries: any[] = [];
                    let current: any = null;
                    for (const line of lines) {
                      const hashMatch = line.match(
                        /^([0-9a-f]{40}) (\d+) (\d+)/
                      );
                      if (hashMatch) {
                        if (current) entries.push(current);
                        current = {
                          commit: hashMatch[1],
                          originalLine: parseInt(hashMatch[2]),
                          finalLine: parseInt(hashMatch[3])
                        };
                      } else if (current) {
                        if (line.startsWith("author "))
                          current.author = line.slice(7);
                        else if (line.startsWith("author-time "))
                          current.authorTime = parseInt(line.slice(12));
                        else if (line.startsWith("summary "))
                          current.summary = line.slice(8);
                      }
                    }
                    if (current) entries.push(current);
                    blame = entries;
                  } catch {
                    blame = null;
                  }
                }
              }

              send(
                ok(msg.id, {
                  uri: uri.toString(),
                  symbols,
                  callGraph,
                  blame
                })
              );
              return;
            }
            case "debug.runTestAndCaptureFailure": {
              const params = msg.params as any;
              const configuration = params?.configuration;
              const folderUri = parseUri(params?.folderUri);
              const timeoutMs = params?.timeoutMs ?? 120000;

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
              if (typeof timeoutMs !== "number" || timeoutMs < 1000) {
                send(err(msg.id, "E_INVALID_PARAMS", "Invalid timeoutMs"));
                return;
              }

              const folder = folderUri
                ? vscode.workspace.getWorkspaceFolder(folderUri)
                : vscode.workspace.workspaceFolders?.[0];

              // Capture diagnostics before
              const diagsBefore = new Set(
                vscode.languages
                  .getDiagnostics()
                  .flatMap(([u, ds]) =>
                    ds.map((d) => `${u.toString()}:${d.range.start.line}:${d.message}`)
                  )
              );

              const started = await vscode.debug.startDebugging(
                folder,
                configuration as vscode.DebugConfiguration
              );

              if (!started) {
                send(
                  ok(msg.id, {
                    started: false,
                    exitedCleanly: false,
                    diagnosticsAfter: [],
                    failures: [{ reason: "Debug session failed to start" }]
                  })
                );
                return;
              }

              // Wait for debug session to terminate
              const exitedCleanly = await new Promise<boolean>((resolve) => {
                const timer = setTimeout(() => resolve(false), timeoutMs);
                const disposable = vscode.debug.onDidTerminateDebugSession(
                  () => {
                    clearTimeout(timer);
                    disposable.dispose();
                    resolve(true);
                  }
                );
              });

              // Small delay for diagnostics to settle
              // A 1-second delay is used here because VS Code diagnostics updates are eventual 
              // and there's no reliable "diagnostics settled" event we can await after debugging.
              await new Promise((r) => setTimeout(r, 1000));

              // Capture new diagnostics
              const diagsAfter = vscode.languages.getDiagnostics();
              const newDiags: any[] = [];
              for (const [u, ds] of diagsAfter) {
                for (const d of ds) {
                  const key = `${u.toString()}:${d.range.start.line}:${d.message}`;
                  if (!diagsBefore.has(key)) {
                    newDiags.push({
                      uri: u.toString(),
                      ...serializeDiagnostic(d)
                    });
                  }
                }
              }

              send(
                ok(msg.id, {
                  started: true,
                  exitedCleanly,
                  diagnosticsAfter: newDiags,
                  failures: newDiags.filter((d: any) => d.severity === 0)
                })
              );
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
        const subs = eventSubsBySocket.get(socket);
        if (subs) {
          for (const id of subs) eventSubsById.delete(id);
          eventSubsBySocket.delete(socket);
        }
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
  const taskCaptureWaiter = new Map<string, (exitCode: number | null) => void>();
  const debugSessionById = new Map<string, vscode.DebugSession>();
  const actionById = new Map<
    string,
    { edit?: vscode.WorkspaceEdit; command?: vscode.Command; title: string; kind?: string }
  >();
  const actionOwner = new Map<string, WebSocket>();

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      for (const uri of e.uris) {
        emitEvent("diagnostics.changed", { uri: uri.toString() });
        if (diagSubscribers.size) {
          broadcast(
            notify("diagnostics.changed", { uri: uri.toString() }),
            diagSubscribers
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      const taskId = executionToId.get(e.execution);
      if (!taskId) return;
      const waiter = taskCaptureWaiter.get(taskId);
      if (waiter) {
        taskCaptureWaiter.delete(taskId);
        waiter(e.exitCode ?? null);
      }
      broadcast(
        notify("tasks.exit", {
          taskId,
          exitCode: e.exitCode ?? null
        })
      );
      emitEvent("tasks.exit", { taskId, exitCode: e.exitCode ?? null });
      executionToId.delete(e.execution);
      runningTasks.delete(taskId);
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((s) => {
      debugSessionById.set(s.id, s);
      emitEvent("debug.sessionStarted", { id: s.id, name: s.name, type: s.type });
      if (debugSubscribers.size) {
        broadcast(
          notify("debug.sessionStarted", {
            id: s.id,
            name: s.name,
            type: s.type
          }),
          debugSubscribers
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession((s) => {
      debugSessionById.delete(s.id);
      emitEvent("debug.sessionTerminated", { id: s.id, name: s.name, type: s.type });
      if (debugSubscribers.size) {
        broadcast(
          notify("debug.sessionTerminated", {
            id: s.id,
            name: s.name,
            type: s.type
          }),
          debugSubscribers
        );
      }
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
