/**
 * memory-handlers.ts
 *
 * Implements the `.ai/` Project Memory system as bridge RPC methods.
 * Reads/writes/searches the `.ai/` directory structure:
 *
 *   Layer 1 (always-loaded):  IDENTITY.md, CONVENTIONS.md, DECISIONS.md
 *   Layer 2 (on-demand):      memory/*.md, journal/*.md
 *
 * Each handler function takes workspace root + params, and returns
 * a result object or throws a MemoryError.
 */

import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

// ── Error type ──────────────────────────────────────────────────

export class MemoryError extends Error {
    constructor(
        public readonly code: "E_NOT_FOUND" | "E_INVALID_PARAMS" | "E_FAILED",
        message: string,
        public readonly data?: unknown
    ) {
        super(message);
        this.name = "MemoryError";
    }
}

// ── Helpers ─────────────────────────────────────────────────────

const AI_DIR = ".ai";
const LAYER1_FILES = ["IDENTITY.md", "CONVENTIONS.md", "DECISIONS.md"] as const;

async function readTextFile(filePath: string): Promise<string | null> {
    try {
        return await readFile(filePath, "utf8");
    } catch {
        return null;
    }
}

interface FrontMatter {
    [key: string]: string | string[] | undefined;
}

/**
 * Parse simple YAML frontmatter (--- delimited) from markdown.
 * Returns { meta, body } where meta is a flat key-value map.
 */
function parseFrontMatter(content: string): { meta: FrontMatter; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };

    const meta: FrontMatter = {};
    for (const line of match[1].split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx < 0) continue;
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        // Parse simple arrays: [a, b, c]
        if (value.startsWith("[") && value.endsWith("]")) {
            meta[key] = value
                .slice(1, -1)
                .split(",")
                .map((s) => s.trim());
        } else {
            meta[key] = value;
        }
    }
    return { meta, body: match[2] };
}

function aiDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, AI_DIR);
}

// ── Handler: memory.context.bootstrap ───────────────────────────

export interface BootstrapResult {
    identity: string | null;
    conventions: string | null;
    decisions: string | null;
    memoryTopics: string[];
    journalEntries: string[];
}

/**
 * Returns the full Layer 1 context plus an index of Layer 2 items.
 * This is the single RPC call an agent needs at session start.
 */
export async function bootstrap(workspaceRoot: string): Promise<BootstrapResult> {
    const base = aiDir(workspaceRoot);

    const [identity, conventions, decisions] = await Promise.all(
        LAYER1_FILES.map((f) => readTextFile(path.join(base, f)))
    );

    const memoryTopics = await listDir(path.join(base, "memory"));
    const journalEntries = await listDir(path.join(base, "journal"));

    return { identity, conventions, decisions, memoryTopics, journalEntries };
}

// ── Handler: memory.identity / conventions / decisions ──────────

export async function readLayer1(
    workspaceRoot: string,
    file: (typeof LAYER1_FILES)[number]
): Promise<{ content: string; meta: FrontMatter }> {
    const content = await readTextFile(path.join(aiDir(workspaceRoot), file));
    if (content === null) {
        throw new MemoryError("E_NOT_FOUND", `${file} not found in .ai/ directory`);
    }
    const { meta, body } = parseFrontMatter(content);
    return { content: body, meta };
}

// ── Handler: memory.search ──────────────────────────────────────

export interface MemorySearchResult {
    topic: string;
    meta: FrontMatter;
    content: string;
}

/**
 * Search Layer 2 knowledge items by topic name or tags.
 * Returns matching items with full content.
 */
export async function search(
    workspaceRoot: string,
    params: { query?: string; tags?: string[]; topic?: string }
): Promise<MemorySearchResult[]> {
    const memDir = path.join(aiDir(workspaceRoot), "memory");
    const files = await listDir(memDir);
    if (files.length === 0) return [];

    const results: MemorySearchResult[] = [];
    const queryLower = params.query?.toLowerCase();
    const tagSet = params.tags ? new Set(params.tags.map((t) => t.toLowerCase())) : null;
    const topicLower = params.topic?.toLowerCase();

    for (const filename of files) {
        if (!filename.endsWith(".md")) continue;

        const content = await readTextFile(path.join(memDir, filename));
        if (!content) continue;

        const { meta, body } = parseFrontMatter(content);
        const topic = filename.replace(/\.md$/, "");

        // Filter by explicit topic
        if (topicLower && topic.toLowerCase() !== topicLower) continue;

        // Filter by tags
        if (tagSet) {
            const itemTags = Array.isArray(meta.tags)
                ? meta.tags.map((t) => t.toLowerCase())
                : [];
            const hasMatch = itemTags.some((t) => tagSet.has(t));
            if (!hasMatch) continue;
        }

        // Filter by free-text query (searches topic name, tags, and body)
        if (queryLower && !topicLower && !tagSet) {
            const searchable = `${topic} ${JSON.stringify(meta.tags ?? [])} ${body}`.toLowerCase();
            if (!searchable.includes(queryLower)) continue;
        }

        results.push({ topic, meta, content: body });
    }

    return results;
}

// ── Handler: memory.learn ───────────────────────────────────────

export interface LearnParams {
    topic: string;
    content: string;
    tags?: string[];
    confidence?: "high" | "medium" | "low";
    related?: string[];
    overwrite?: boolean;
}

/**
 * Writes a new knowledge item to .ai/memory/.
 * If the topic already exists and overwrite is not true, throws an error.
 */
export async function learn(
    workspaceRoot: string,
    params: LearnParams
): Promise<{ written: string; bytes: number }> {
    if (!params.topic || typeof params.topic !== "string") {
        throw new MemoryError("E_INVALID_PARAMS", "Missing or invalid topic");
    }
    if (!params.content || typeof params.content !== "string") {
        throw new MemoryError("E_INVALID_PARAMS", "Missing or invalid content");
    }

    // Sanitize topic to filesystem-safe name
    const safeTopic = params.topic
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    const memDir = path.join(aiDir(workspaceRoot), "memory");
    await mkdir(memDir, { recursive: true });

    const filePath = path.join(memDir, `${safeTopic}.md`);

    // Check if file exists and overwrite is not set
    if (!params.overwrite) {
        try {
            await stat(filePath);
            throw new MemoryError("E_FAILED", `Topic "${safeTopic}" already exists. Set overwrite=true to replace.`);
        } catch (e) {
            if (e instanceof MemoryError) throw e;
            // File doesn't exist, proceed
        }
    }

    const now = new Date().toISOString().split("T")[0];
    const tags = params.tags ?? [];
    const confidence = params.confidence ?? "medium";
    const related = params.related ?? [];

    const frontMatter = [
        "---",
        `topic: ${safeTopic}`,
        `tags: [${tags.join(", ")}]`,
        `updated: ${now}`,
        `confidence: ${confidence}`,
        ...(related.length ? [`related: [${related.join(", ")}]`] : []),
        "---",
        "",
    ].join("\n");

    const fullContent = frontMatter + params.content + "\n";
    await writeFile(filePath, fullContent, "utf8");

    return { written: `${safeTopic}.md`, bytes: Buffer.byteLength(fullContent) };
}

// ── Handler: memory.journal.write ───────────────────────────────

export interface JournalParams {
    summary: string;
    agent?: string;
    session?: string;
    details?: string;
}

/**
 * Writes a timestamped session journal entry to .ai/journal/.
 */
export async function journalWrite(
    workspaceRoot: string,
    params: JournalParams
): Promise<{ written: string; bytes: number }> {
    if (!params.summary || typeof params.summary !== "string") {
        throw new MemoryError("E_INVALID_PARAMS", "Missing or invalid summary");
    }

    const journalDir = path.join(aiDir(workspaceRoot), "journal");
    await mkdir(journalDir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].slice(0, 5).replace(":", "");
    const slug = params.summary
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

    const filename = `${dateStr}-${timeStr}-${slug}.md`;
    const filePath = path.join(journalDir, filename);

    const content = [
        "---",
        `date: ${dateStr}`,
        `agent: ${params.agent ?? "unknown"}`,
        ...(params.session ? [`session: ${params.session}`] : []),
        `summary: ${params.summary}`,
        "---",
        "",
        `# ${params.summary}`,
        "",
        ...(params.details ? [params.details, ""] : []),
    ].join("\n");

    await writeFile(filePath, content, "utf8");

    return { written: filename, bytes: Buffer.byteLength(content) };
}

// ── Handler: memory.list ────────────────────────────────────────

/**
 * Lists all available knowledge items and journal entries.
 */
export async function list(
    workspaceRoot: string
): Promise<{ memory: string[]; journal: string[]; layer1: string[] }> {
    const base = aiDir(workspaceRoot);

    const layer1: string[] = [];
    for (const f of LAYER1_FILES) {
        const content = await readTextFile(path.join(base, f));
        if (content !== null) layer1.push(f);
    }

    return {
        layer1,
        memory: await listDir(path.join(base, "memory")),
        journal: await listDir(path.join(base, "journal")),
    };
}

// ── Utility ─────────────────────────────────────────────────────

async function listDir(dirPath: string): Promise<string[]> {
    try {
        const entries = await readdir(dirPath);
        return entries.filter((e) => e.endsWith(".md")).sort();
    } catch {
        return [];
    }
}
