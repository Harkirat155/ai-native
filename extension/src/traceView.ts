import * as vscode from "vscode";

export type TraceItem = {
  ts: number;
  kind: "rpc" | "event";
  name: string;
  summary: string;
  data?: unknown;
};

export class TraceBuffer {
  private items: TraceItem[] = [];
  private max: number;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(max = 200) {
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
}

export class TraceTreeProvider
  implements vscode.TreeDataProvider<TraceItem>
{
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
    const item = new vscode.TreeItem(
      `${dt} ${element.kind === "rpc" ? "RPC" : "EV"} ${element.name}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = element.summary;
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

