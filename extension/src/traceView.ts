import * as vscode from "vscode";

export type TraceItem = {
  ts: number;
  kind: "rpc" | "event" | "agent-step" | "tx" | "diagnostics";
  name: string;
  summary: string;
  data?: unknown;
  status?: "pending" | "success" | "error";
};

export class TraceBuffer {
  private items: TraceItem[] = [];
  private max: number;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  // Buffer size increased to 500 to better support long-running agent workflows 
  // without overwhelming memory, while keeping sufficient history for debugging.
  constructor(max = 500) {
    this.max = max;
  }

  push(item: TraceItem) {
    this.items.push(item);
    while (this.items.length > this.max) this.items.shift();
    this.onDidChangeEmitter.fire();
  }

  list(): TraceItem[] {
    return [...this.items];
  }

  /** Update the last item matching a predicate. */
  updateLast(predicate: (item: TraceItem) => boolean, update: Partial<TraceItem>) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (predicate(this.items[i])) {
        Object.assign(this.items[i], update);
        this.onDidChangeEmitter.fire();
        return;
      }
    }
  }
}

const ICONS: Record<string, vscode.ThemeIcon> = {
  "rpc": new vscode.ThemeIcon("symbol-method"),
  "event": new vscode.ThemeIcon("zap"),
  "agent-step": new vscode.ThemeIcon("rocket"),
  "tx": new vscode.ThemeIcon("git-commit"),
  "diagnostics": new vscode.ThemeIcon("warning"),
};

const STATUS_ICONS: Record<string, vscode.ThemeIcon> = {
  "pending": new vscode.ThemeIcon("loading~spin"),
  "success": new vscode.ThemeIcon("check"),
  "error": new vscode.ThemeIcon("error"),
};

export class TraceTreeProvider
  implements vscode.TreeDataProvider<TraceItem> {
  private onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<TraceItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private buffer: TraceBuffer) {
    buffer.onDidChange(() => this.refresh());
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TraceItem): vscode.TreeItem {
    const dt = new Date(element.ts).toLocaleTimeString();
    const kindLabel = {
      "rpc": "RPC",
      "event": "EV",
      "agent-step": "STEP",
      "tx": "TX",
      "diagnostics": "DIAG"
    }[element.kind] ?? element.kind.toUpperCase();

    const item = new vscode.TreeItem(
      `${dt} ${kindLabel} ${element.name}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = element.summary;
    item.iconPath = element.status
      ? STATUS_ICONS[element.status] ?? ICONS[element.kind]
      : ICONS[element.kind] ?? new vscode.ThemeIcon("circle-outline");
    item.tooltip = new vscode.MarkdownString(
      "```json\n" + JSON.stringify(element.data ?? {}, null, 2) + "\n```"
    );
    return item;
  }

  getChildren(): Thenable<TraceItem[]> {
    // newest first
    return Promise.resolve(this.buffer.list().slice().reverse());
  }
}
