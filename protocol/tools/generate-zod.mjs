import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const schemaPath = path.join(root, "protocol", "schemas", "v1.json");
const outPath = path.join(root, "protocol", "dist", "zod.ts");

const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
const specs = schema?.$defs?.MethodsSpec?.properties ?? {};

/**
 * Recursively convert a JSON Schema node to a Zod expression string.
 */
function jsonSchemaToZod(node, depth = 0) {
    if (!node || typeof node !== "object") return "z.unknown()";

    if (node.$ref) {
        const refName = node.$ref.split("/").pop();
        return `${refName}Schema`;
    }
    if (node.const !== undefined) {
        return typeof node.const === "string"
            ? `z.literal(${JSON.stringify(node.const)})`
            : `z.literal(${node.const})`;
    }
    if (node.oneOf) {
        const variants = node.oneOf.map((v) => jsonSchemaToZod(v, depth + 1));
        return `z.union([${variants.join(", ")}])`;
    }

    const t = Array.isArray(node.type) ? node.type : [node.type];
    if (t.includes("null") && t.length === 2) {
        const other = t.find((x) => x !== "null");
        return `${jsonSchemaToZod({ ...node, type: other }, depth + 1)}.nullable()`;
    }

    const type = t[0];
    switch (type) {
        case "string": {
            let z = "z.string()";
            if (node.minLength) z += `.min(${node.minLength})`;
            return z;
        }
        case "number":
        case "integer": {
            let z = type === "integer" ? "z.number().int()" : "z.number()";
            if (node.minimum !== undefined) z += `.min(${node.minimum})`;
            if (node.maximum !== undefined) z += `.max(${node.maximum})`;
            return z;
        }
        case "boolean":
            return "z.boolean()";
        case "null":
            return "z.null()";
        case "array": {
            const items = node.items ? jsonSchemaToZod(node.items, depth + 1) : "z.unknown()";
            return `z.array(${items})`;
        }
        case "object": {
            if (!node.properties || Object.keys(node.properties).length === 0) {
                return "z.record(z.unknown())";
            }
            const required = new Set(node.required ?? []);
            const fields = Object.entries(node.properties)
                .map(([key, val]) => {
                    const zVal = jsonSchemaToZod(val, depth + 1);
                    const isOpt = !required.has(key);
                    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
                    return `  ${safeKey}: ${zVal}${isOpt ? ".optional()" : ""}`;
                })
                .join(",\n");
            return `z.object({\n${fields}\n})`;
        }
        default:
            return "z.unknown()";
    }
}

// Build output
const lines = [];
lines.push('// Generated file. Do not edit by hand.');
lines.push('// Source: protocol/schemas/v1.json');
lines.push('');
lines.push('import { z } from "zod";');
lines.push('');

// Common schemas
lines.push('// ─── Common types ───');
lines.push('export const MetaSchema = z.object({');
lines.push('  confidence: z.number().min(0).max(1).optional(),');
lines.push('  reasoning: z.string().optional()');
lines.push('});');
lines.push('');
lines.push('export const PositionSchema = z.object({');
lines.push('  line: z.number().int().min(0),');
lines.push('  character: z.number().int().min(0)');
lines.push('});');
lines.push('');
lines.push('export const RangeSchema = z.object({');
lines.push('  start: PositionSchema,');
lines.push('  end: PositionSchema');
lines.push('});');
lines.push('');
lines.push('export const TextEditSchema = z.object({');
lines.push('  range: RangeSchema,');
lines.push('  newText: z.string()');
lines.push('});');
lines.push('');
lines.push('export const UriSchema = z.string().min(1);');
lines.push('');

// Method-specific schemas
lines.push('// ─── Method schemas ───');
const methodNames = Object.keys(specs).sort();

for (const name of methodNames) {
    const spec = specs[name];
    const params = spec?.properties?.params;
    const result = spec?.properties?.result;

    const safeName = name.replace(/\./g, "_");

    // Params schema
    if (params) {
        lines.push(`export const ${safeName}_ParamsSchema = ${jsonSchemaToZod(params)};`);
    } else {
        lines.push(`export const ${safeName}_ParamsSchema = z.object({});`);
    }

    // Result schema
    if (result) {
        lines.push(`export const ${safeName}_ResultSchema = ${jsonSchemaToZod(result)};`);
    } else {
        lines.push(`export const ${safeName}_ResultSchema = z.record(z.unknown());`);
    }

    // Inferred types
    lines.push(`export type ${safeName}_Params = z.infer<typeof ${safeName}_ParamsSchema>;`);
    lines.push(`export type ${safeName}_Result = z.infer<typeof ${safeName}_ResultSchema>;`);
    lines.push('');
}

// Method map
lines.push('// ─── Method map (for tool-calling frameworks) ───');
lines.push('export const BRIDGE_METHODS = {');
for (const name of methodNames) {
    const safeName = name.replace(/\./g, "_");
    lines.push(`  ${JSON.stringify(name)}: { params: ${safeName}_ParamsSchema, result: ${safeName}_ResultSchema },`);
}
lines.push('} as const;');
lines.push('');
lines.push('export type BridgeMethodName = keyof typeof BRIDGE_METHODS;');
lines.push('');

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${outPath} (${methodNames.length} methods)`);
