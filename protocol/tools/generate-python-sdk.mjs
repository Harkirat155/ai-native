import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Repo root (protocol/tools/.. -> protocol/.. -> repo root)
const root = path.resolve(__dirname, "..", "..");

const toolpackPath = path.join(root, "docs", "protocol-v1.json");
const outPath = path.join(
  root,
  "python-sdk",
  "src",
  "ai_native_vscode_bridge",
  "generated_methods.py"
);

const pack = JSON.parse(await fs.readFile(toolpackPath, "utf8"));
const methods = (pack.toolpack ?? []).map((t) => t.name).sort();

const toPyName = (m) =>
  m.replace(/\./g, "_").replace(/[^a-zA-Z0-9_]/g, "_");

const lines = [];
lines.push("# Generated file. Do not edit by hand.");
lines.push("# Source: docs/protocol-v1.json");
lines.push("");
lines.push("from __future__ import annotations");
lines.push("");
lines.push("from typing import Any, Dict, Optional");
lines.push("");
lines.push("from .client import BridgeClient");
lines.push("");
lines.push("class BridgeMethodsMixin:");
for (const m of methods) {
  const py = toPyName(m);
  lines.push(`    async def ${py}(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:`);
  lines.push(`        return await self.call(${JSON.stringify(m)}, params)`);
  lines.push("");
}
lines.push("");

await fs.writeFile(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${outPath}`);
