import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..", "..");
const schemaPath = path.join(root, "protocol", "schemas", "v1.json");
const docsDir = path.join(root, "docs");
const openapiPath = path.join(root, "protocol", "openapi.json");
const llmPackPath = path.join(docsDir, "protocol-v1.json");
const mdPath = path.join(docsDir, "protocol-v1.md");

const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
const specs = schema?.$defs?.MethodsSpec?.properties ?? {};
const defs = schema?.$defs ?? {};

await fs.mkdir(docsDir, { recursive: true });

// LLM toolpack: optimized for function calling.
const toolpack = Object.entries(specs).map(([name, spec]) => {
  const params = spec?.properties?.params ?? { type: "object" };
  const result = spec?.properties?.result ?? { type: "object" };
  return {
    name,
    description:
      spec?.properties?.description?.default ??
      spec?.properties?.description?.const ??
      `VS Code Bridge method: ${name}`,
    input_schema: params,
    output_schema: result,
    examples: spec?.properties?.examples?.default ?? []
  };
});

await fs.writeFile(llmPackPath, JSON.stringify({ version: "v1", toolpack }, null, 2) + "\n");

// Minimal OpenAPI: single /rpc endpoint with JSON-RPC envelope.
const openapi = {
  openapi: "3.1.0",
  info: { title: "VS Code Bridge", version: "v1" },
  components: { schemas: defs },
  paths: {
    "/rpc": {
      post: {
        summary: "JSON-RPC endpoint",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: schema.$defs.JsonRpcRequestEnvelope
            }
          }
        },
        responses: {
          "200": {
            description: "JSON-RPC response",
            content: {
              "application/json": {
                schema: {
                  oneOf: [schema.$defs.JsonRpcSuccessEnvelope, schema.$defs.JsonRpcErrorEnvelope]
                }
              }
            }
          }
        }
      }
    }
  }
};

await fs.writeFile(openapiPath, JSON.stringify(openapi, null, 2) + "\n");

// Human doc (minimal, but stable).
const lines = [];
lines.push("# VS Code Bridge Protocol v1");
lines.push("");
lines.push("This file is generated. Canonical schemas: `protocol/schemas/v1.json`.");
lines.push("");
lines.push("## Methods");
for (const t of toolpack) {
  lines.push(`### ${t.name}`);
  lines.push("");
  lines.push(t.description);
  lines.push("");
  lines.push("Input schema:");
  lines.push("```json");
  lines.push(JSON.stringify(t.input_schema, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Output schema:");
  lines.push("```json");
  lines.push(JSON.stringify(t.output_schema, null, 2));
  lines.push("```");
  lines.push("");
}
await fs.writeFile(mdPath, lines.join("\n") + "\n");

console.log(`Wrote ${llmPackPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`Wrote ${openapiPath}`);
