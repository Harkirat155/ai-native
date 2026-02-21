import WebSocket from "ws";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runMcp } from "./mcp.js";

type Args = {
  port: number;
  token: string;
  tokenFile?: string;
  method: string;
  params: Record<string, unknown>;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const port = Number(get("--port") ?? 57110);
  const token = String(get("--token") ?? "");
  const tokenFile = get("--token-file");

  const method =
    get("--method") ??
    argv.find((a) => !a.startsWith("--")) ??
    "bridge.ping";

  const paramsJson = get("--params");
  const paramsFile = get("--params-file");

  let params: Record<string, unknown> = {};
  if (paramsJson) {
    params = JSON.parse(paramsJson);
  } else if (paramsFile) {
    params = JSON.parse(readFileSync(paramsFile, "utf8"));
  }

  return { port, token, tokenFile, method, params };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      [
        "vscode-bridge doctor [--port 57110] [--token-file <path>]",
        "vscode-bridge mcp [--port 57110] [--token <token> | --token-file <path>]",
        "vscode-bridge [--token <token> | --token-file <path>] [--port 57110] [--method <method>] [--params <json>] [--params-file <path>]",
        "",
        "Examples:",
        "  vscode-bridge doctor",
        "  vscode-bridge mcp  # MCP stdio server",
        "  vscode-bridge --token $TOKEN --method bridge.capabilities",
        "  vscode-bridge --token-file .vscode/bridge.token --method bridge.capabilities",
        "  vscode-bridge --token $TOKEN --method diagnostics.list",
        "  vscode-bridge --token $TOKEN --method doc.read --params '{\"uri\":\"file:///...\"}'"
      ].join("\n")
    );
    return;
  }

  if (argv[0] === "mcp") {
    await runMcp(argv.slice(1));
    return;
  }

  if (argv[0] === "doctor") {
    const parsed = parseArgs(argv.slice(1));
    const port = parsed.port;
    const tokenFile =
      parsed.tokenFile ?? path.join(process.cwd(), ".vscode", "bridge.token");
    const tokenFromFile = (() => {
      try {
        return readFileSync(tokenFile, "utf8").trim();
      } catch {
        return "";
      }
    })();

    const code = (() => {
      const r = spawnSync("code", ["--version"], { encoding: "utf8" });
      return { ok: r.status === 0, err: r.error ? String(r.error) : null };
    })();

    const extInstalled = (() => {
      const r = spawnSync("code", ["--list-extensions"], { encoding: "utf8" });
      if (r.status !== 0) return { ok: false, installed: false };
      const list = (r.stdout ?? "").split("\n").map((s) => s.trim());
      return { ok: true, installed: list.includes("ai-native.vscode-bridge") };
    })();

    const wsReachable = await (async () => {
      try {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => resolve());
          ws.on("error", (e) => reject(e));
        });
        ws.close();
        return true;
      } catch {
        return false;
      }
    })();

    const problems: string[] = [];
    if (!code.ok) {
      problems.push(
        "VS Code CLI `code` not found. Install VS Code and enable the `code` command in PATH."
      );
    }
    if (code.ok && extInstalled.ok && !extInstalled.installed) {
      problems.push(
        "Extension ai-native.vscode-bridge not installed. Run: code --install-extension ai-native.vscode-bridge"
      );
    }
    if (!tokenFromFile) {
      problems.push(
        `Token file missing/empty at ${tokenFile}. Set bridge.pairing.exportTokenPath to .vscode/bridge.token and reload the window.`
      );
    }
    if (!wsReachable) {
      problems.push(
        `Bridge not reachable on ws://127.0.0.1:${port}. Ensure the extension is enabled (bridge.enabled=true).`
      );
    }

    if (problems.length) {
      console.error(problems.map((p) => `- ${p}`).join("\n"));
      process.exit(1);
    }

    console.log("OK: code CLI present, extension installed, token exported, bridge reachable.");
    return;
  }

  const parsed = parseArgs(argv);
  const port = parsed.port;
  const method = parsed.method;
  const params = parsed.params;

  const token =
    parsed.token ||
    process.env.BRIDGE_TOKEN ||
    process.env.TOKEN ||
    (() => {
      const f =
        parsed.tokenFile ??
        path.join(process.cwd(), ".vscode", "bridge.token");
      try {
        return readFileSync(f, "utf8").trim();
      } catch {
        return "";
      }
    })();

  if (!token) {
    console.error(
      "Missing token. Provide --token, set $BRIDGE_TOKEN, or create .vscode/bridge.token."
    );
    process.exit(2);
  }

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

  const resp = await new Promise<string>((resolve, reject) => {
    ws.on("message", (m) => resolve(m.toString("utf8")));
    ws.on("error", (e) => reject(e));
  });

  console.log(resp);
  ws.close();
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
