import WebSocket from "ws";
import { readFileSync } from "node:fs";
import path from "node:path";

type McpArgs = {
  port: number;
  token: string;
  tokenFile?: string;
};

type JsonRpcId = string | number | null;
type JsonRpcMsg =
  | { jsonrpc: "2.0"; id: JsonRpcId; method: string; params?: any }
  | { jsonrpc: "2.0"; method: string; params?: any };

function parseMcpArgs(argv: string[]): McpArgs {
  const get = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const port = Number(get("--port") ?? 57110);
  const token = String(get("--token") ?? "");
  const tokenFile = get("--token-file");
  return { port, token, tokenFile };
}

function resolveToken(token: string, tokenFile?: string): string {
  if (token) return token;
  if (process.env.BRIDGE_TOKEN) return process.env.BRIDGE_TOKEN;
  if (process.env.TOKEN) return process.env.TOKEN;
  const f = tokenFile ?? path.join(process.cwd(), ".vscode", "bridge.token");
  try {
    return readFileSync(f, "utf8").trim();
  } catch {
    return "";
  }
}

function writeLsp(msg: unknown) {
  const json = JSON.stringify(msg);
  const bytes = Buffer.byteLength(json, "utf8");
  process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${json}`);
}

async function callBridge(
  port: number,
  token: string,
  method: string,
  params: Record<string, unknown>
): Promise<any> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });

  const id = 1;
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: { ...params, auth: { token } }
    })
  );

  const resp = await new Promise<any>((resolve, reject) => {
    ws.on("message", (m) => resolve(JSON.parse(m.toString("utf8"))));
    ws.on("error", (e) => reject(e));
  });
  ws.close();
  return resp;
}

function loadToolpack():
  | null
  | { toolpack: Array<{ name: string; description: string; input_schema: any }> } {
  const candidates = [
    path.join(process.cwd(), "docs", "protocol-v1.json"),
    path.join(process.cwd(), "protocol-v1.json")
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      // ignore
    }
  }
  return null;
}

export async function runMcp(argv: string[]) {
  const args = parseMcpArgs(argv);
  const token = resolveToken(args.token, args.tokenFile);
  if (!token) {
    console.error(
      "Missing token. Provide --token, set $BRIDGE_TOKEN, or create .vscode/bridge.token."
    );
    process.exit(2);
  }

  const toolpack = loadToolpack();

  const listTools = async () => {
    if (toolpack?.toolpack?.length) {
      return toolpack.toolpack.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema ?? { type: "object" }
      }));
    }

    const caps = await callBridge(args.port, token, "bridge.capabilities", {});
    const methods: string[] = caps?.result?.methods ?? [];
    return methods.map((name) => ({
      name,
      description: `VS Code Bridge method: ${name}`,
      inputSchema: { type: "object" }
    }));
  };

  const handle = async (req: any) => {
    const id = req.id;
    const method = req.method;

    if (method === "initialize") {
      writeLsp({
        jsonrpc: "2.0",
        id,
        result: {
          serverInfo: { name: "vscode-bridge", version: "0.0.1" },
          capabilities: { tools: {} }
        }
      });
      return;
    }

    if (method === "tools/list") {
      const tools = await listTools();
      writeLsp({ jsonrpc: "2.0", id, result: { tools } });
      return;
    }

    if (method === "tools/call") {
      const name = req.params?.name;
      const input = req.params?.arguments ?? {};
      if (typeof name !== "string") {
        writeLsp({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Missing/invalid tool name" }
        });
        return;
      }
      const resp = await callBridge(args.port, token, name, input);
      if (resp?.error) {
        writeLsp({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: resp.error.message ?? "Bridge error",
            data: resp.error
          }
        });
        return;
      }
      writeLsp({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(resp.result, null, 2) }]
        }
      });
      return;
    }

    writeLsp({ jsonrpc: "2.0", id, error: { code: -32601, message: "Not found" } });
  };

  // Minimal LSP-style framing.
  let buf = Buffer.alloc(0);
  process.stdin.on("data", async (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Drop invalid header.
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buf.length < bodyStart + len) return;
      const body = buf.slice(bodyStart, bodyStart + len).toString("utf8");
      buf = buf.slice(bodyStart + len);

      let msg: JsonRpcMsg;
      try {
        msg = JSON.parse(body);
      } catch {
        continue;
      }
      if ((msg as any).jsonrpc !== "2.0" || typeof (msg as any).method !== "string") {
        continue;
      }
      if (!("id" in (msg as any))) {
        continue; // notifications ignored
      }
      void handle(msg);
    }
  });
}

