/**
 * cli.ts — CLI entry point for `npx ai-context`.
 *
 * Subcommands:
 *   init    — Generate .ai/ for the current project
 *   status  — Show what .ai/ contains
 *   update  — Re-generate, merging with existing files
 */

import path from "node:path";
import { access, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { detectProject, detectConventions } from "./detector.js";
import {
    generateIdentity,
    generateConventions,
    generateDecisions,
    generateSpec,
} from "./generator.js";

// ── Colors (no dependency) ──────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

// ── CLI parsing ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const getArg = (key: string) => {
    const idx = args.indexOf(key);
    return idx >= 0 ? args[idx + 1] : undefined;
};
const hasFlag = (key: string) => args.includes(key);

const root = path.resolve(getArg("--root") ?? getArg("-r") ?? ".");
const force = hasFlag("--force") || hasFlag("-f");
const aiDir = path.join(root, ".ai");

async function exists(p: string): Promise<boolean> {
    try { await access(p); return true; } catch { return false; }
}

// ── Commands ────────────────────────────────────────────────────

async function init() {
    console.log("");
    console.log(bold("🧠 ai-context") + dim(" — bootstrap .ai/ project memory"));
    console.log(dim(`   project: ${root}`));
    console.log("");

    // Detect
    const info = await detectProject(root);
    const conv = await detectConventions(root, info);

    console.log(`  ${cyan("📦")} Project: ${bold(info.name)} ${dim(`(${info.language}${info.framework ? ` / ${info.framework}` : ""})`)}`)
    console.log(`  ${cyan("📁")} Modules: ${info.modules.length} detected`);
    console.log(`  ${cyan("📋")} Dependencies: ${info.dependencies.length} found`);
    console.log(`  ${cyan("🔧")} CI files: ${info.ciFiles.length} found`);
    console.log(`  ${cyan("🎨")} Style: ${conv.style.trim() || dim("(none)")}`);
    console.log(`  ${cyan("🧪")} Testing: ${conv.testing || dim("(none)")}`);
    console.log(`  ${cyan("🔨")} Build: ${conv.buildTool || dim("(default)")}`);
    console.log("");

    // Guard
    if ((await exists(aiDir)) && !force) {
        console.log(yellow("  ⚠  .ai/ already exists. Use --force to overwrite."));
        console.log(dim("     Or use: ai-context update"));
        console.log("");
        process.exit(1);
    }

    // Create dirs
    await mkdir(path.join(aiDir, "memory"), { recursive: true });
    await mkdir(path.join(aiDir, "journal"), { recursive: true });

    // Generate files
    const files = [
        { name: "IDENTITY.md", content: generateIdentity(info) },
        { name: "CONVENTIONS.md", content: generateConventions(info, conv) },
        { name: "DECISIONS.md", content: generateDecisions(info) },
        { name: "SPEC.md", content: generateSpec() },
    ];

    for (const file of files) {
        await writeFile(path.join(aiDir, file.name), file.content, "utf8");
        const bytes = Buffer.byteLength(file.content);
        console.log(`  ${green("✅")} ${file.name} ${dim(`(${bytes} bytes)`)}`);
    }

    const totalB = files.reduce((s, f) => s + Buffer.byteLength(f.content), 0);
    const tokens = Math.round(totalB / 4);

    console.log("");
    console.log(`  ${green("✨")} Created .ai/ — ${bold(String(files.length))} files, ${bold(String(totalB))} bytes, ~${bold(String(tokens))} tokens`);
    console.log("");
    console.log(dim("  Next steps:"));
    console.log(dim("    1. Review and enrich the generated files (especially DECISIONS.md)"));
    console.log(dim("    2. Add knowledge items to .ai/memory/"));
    console.log(dim("    3. Commit .ai/ to version control"));
    console.log("");
}

async function status() {
    console.log("");
    console.log(bold("🧠 ai-context") + dim(" — project memory status"));
    console.log(dim(`   project: ${root}`));
    console.log("");

    if (!(await exists(aiDir))) {
        console.log(yellow("  ⚠  No .ai/ directory found."));
        console.log(dim("     Run: ai-context init"));
        console.log("");
        process.exit(1);
    }

    // Layer 1
    console.log(bold("  Layer 1 (Always Loaded)"));
    for (const file of ["IDENTITY.md", "CONVENTIONS.md", "DECISIONS.md"]) {
        const fp = path.join(aiDir, file);
        if (await exists(fp)) {
            const content = await readFile(fp, "utf8");
            const bytes = Buffer.byteLength(content);
            const lines = content.split("\n").length;
            console.log(`    ${green("●")} ${file} ${dim(`(${lines} lines, ${bytes} bytes)`)}`);
        } else {
            console.log(`    ${red("○")} ${file} ${dim("(missing)")}`);
        }
    }

    // Layer 2 — memory
    console.log("");
    console.log(bold("  Layer 2 — Knowledge Items"));
    const memDir = path.join(aiDir, "memory");
    if (await exists(memDir)) {
        const items = (await readdir(memDir)).filter(f => f.endsWith(".md"));
        if (items.length === 0) {
            console.log(`    ${dim("(empty — use memory.learn via bridge or add files manually)")}`);
        } else {
            for (const item of items) {
                const content = await readFile(path.join(memDir, item), "utf8");
                const bytes = Buffer.byteLength(content);
                console.log(`    ${cyan("◆")} ${item.replace(".md", "")} ${dim(`(${bytes} bytes)`)}`);
            }
        }
    } else {
        console.log(`    ${dim("(no memory/ directory)")}`);
    }

    // Layer 2 — journal
    console.log("");
    console.log(bold("  Layer 2 — Journal Entries"));
    const jrnDir = path.join(aiDir, "journal");
    if (await exists(jrnDir)) {
        const entries = (await readdir(jrnDir)).filter(f => f.endsWith(".md")).sort().reverse();
        if (entries.length === 0) {
            console.log(`    ${dim("(empty — journals are written at end of agent sessions)")}`);
        } else {
            for (const entry of entries.slice(0, 5)) {
                console.log(`    ${dim("📓")} ${entry}`);
            }
            if (entries.length > 5) console.log(dim(`    ... and ${entries.length - 5} more`));
        }
    } else {
        console.log(`    ${dim("(no journal/ directory)")}`);
    }

    // Total
    console.log("");
    let totalBytes = 0;
    for (const file of ["IDENTITY.md", "CONVENTIONS.md", "DECISIONS.md"]) {
        try {
            totalBytes += Buffer.byteLength(await readFile(path.join(aiDir, file), "utf8"));
        } catch { /* missing file */ }
    }
    console.log(`  ${bold("Total L1 budget")}: ~${Math.round(totalBytes / 4)} tokens ${dim(`(target: < 2000)`)}`);
    console.log("");
}

async function update() {
    console.log("");
    console.log(bold("🧠 ai-context update") + dim(" — re-detect and update .ai/"));
    console.log(dim(`   project: ${root}`));
    console.log("");

    if (!(await exists(aiDir))) {
        console.log(yellow("  ⚠  No .ai/ directory found. Run 'ai-context init' first."));
        console.log("");
        process.exit(1);
    }

    // Re-detect and regenerate
    const info = await detectProject(root);
    const conv = await detectConventions(root, info);

    // Only update IDENTITY.md (most volatile) by default
    const identity = generateIdentity(info);
    await writeFile(path.join(aiDir, "IDENTITY.md"), identity, "utf8");
    console.log(`  ${green("✅")} IDENTITY.md ${dim("(regenerated)")}`);

    // Show what changed in conventions
    const conventions = generateConventions(info, conv);
    const existingConv = await readFile(path.join(aiDir, "CONVENTIONS.md"), "utf8").catch(() => null);
    if (existingConv !== conventions) {
        if (force) {
            await writeFile(path.join(aiDir, "CONVENTIONS.md"), conventions, "utf8");
            console.log(`  ${green("✅")} CONVENTIONS.md ${dim("(regenerated)")}`);
        } else {
            console.log(`  ${yellow("△")} CONVENTIONS.md ${dim("has changes — use --force to overwrite")}`);
        }
    } else {
        console.log(`  ${dim("─")} CONVENTIONS.md ${dim("(unchanged)")}`);
    }

    console.log(`  ${dim("─")} DECISIONS.md ${dim("(preserved — manually maintained)")}`);
    console.log("");
}

function help() {
    console.log(``);
    console.log(bold(`🧠 ai-context`) + ` — give AI agents instant project memory`);
    console.log(``);
    console.log(`  ${bold("USAGE")}`);
    console.log(`    ${cyan("npx ai-context init")}       Bootstrap .ai/ for the current project`);
    console.log(`    ${cyan("npx ai-context status")}     Show what .ai/ contains`);
    console.log(`    ${cyan("npx ai-context update")}     Re-detect and update IDENTITY.md`);
    console.log(``);
    console.log(`  ${bold("OPTIONS")}`);
    console.log(`    ${cyan("--root, -r")} <path>   Project root (default: current directory)`);
    console.log(`    ${cyan("--force, -f")}         Overwrite existing .ai/ files`);
    console.log(`    ${cyan("--help, -h")}          Show this help`);
    console.log(``);
    console.log(`  ${bold("WHAT IT DOES")}`);
    console.log(`    Creates a ${cyan(".ai/")} directory in your project with structured context`);
    console.log(`    files that AI coding agents can load at session start. This solves`);
    console.log(`    the "cold start" problem — agents no longer need to re-explore your`);
    console.log(`    project architecture every session.`);
    console.log(``);
    console.log(`    ${bold("Layer 1")} (always loaded, < 2K tokens):`);
    console.log(`      IDENTITY.md     Project DNA — architecture, modules, dependencies`);
    console.log(`      CONVENTIONS.md  Coding patterns, style rules, build commands`);
    console.log(`      DECISIONS.md    Key architectural decisions (ADRs)`);
    console.log(``);
    console.log(`    ${bold("Layer 2")} (searched on-demand):`);
    console.log(`      memory/         Knowledge items by topic`);
    console.log(`      journal/        Session summaries for continuity`);
    console.log(``);
    console.log(`  ${bold("SUPPORTED PROJECTS")}`);
    console.log(`    Node.js / TypeScript, Python, Go, Rust, and generic projects.`);
    console.log(`    Detects frameworks, test tools, build tools, CI/CD automatically.`);
    console.log(``);
    console.log(`  ${bold("SPEC")}`);
    console.log(`    https://github.com/Harkirat155/ai-native`);
    console.log(``);
}

// ── Main ────────────────────────────────────────────────────────

switch (command) {
    case "init":
        await init();
        break;
    case "status":
        await status();
        break;
    case "update":
        await update();
        break;
    case "--help":
    case "-h":
    case "help":
    case undefined:
        help();
        break;
    default:
        console.log(red(`\n  Unknown command: ${command}\n`));
        help();
        process.exit(1);
}
