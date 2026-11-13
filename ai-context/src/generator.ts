/**
 * generator.ts — Generate .ai/ files from detected project info.
 *
 * Takes ProjectInfo + ConventionInfo from detector.ts and produces
 * the content for IDENTITY.md, CONVENTIONS.md, DECISIONS.md, SPEC.md.
 */

import type { ProjectInfo, ConventionInfo } from "./detector.js";

// ── IDENTITY.md ─────────────────────────────────────────────────

export function generateIdentity(info: ProjectInfo): string {
    const today = new Date().toISOString().split("T")[0];

    const moduleTable = info.modules.length ? [
        "## Module Map", "",
        "| Module | Path | Role |", "|--------|------|------|",
        ...info.modules.map(m => `| **${m.name}** | \`${m.path}\` | ${m.role} |`), "",
    ].join("\n") : "";

    const depTable = info.dependencies.length ? [
        "## Key Dependencies", "",
        "| Dependency | Purpose |", "|-----------|---------|",
        ...info.dependencies.map(d => `| \`${d.name}\` | ${d.purpose || "—"} |`), "",
    ].join("\n") : "";

    const scriptsSection = Object.keys(info.scripts).length ? [
        "## Scripts", "", "```sh",
        ...Object.entries(info.scripts).slice(0, 15).map(([k, v]) => `${info.packageManager} run ${k}  # ${v}`),
        "```", "",
    ].join("\n") : "";

    const ciSection = info.ciFiles.length ? [
        "## CI/CD", "", ...info.ciFiles.map(f => `- \`${f}\``), "",
    ].join("\n") : "";

    return [
        "---",
        `project: ${info.name}`,
        `version: ${info.version}`,
        ...(info.license ? [`license: ${info.license}`] : []),
        ...(info.repo ? [`repo: ${info.repo}`] : []),
        ...(info.author ? [`author: ${info.author}`] : []),
        `updated: ${today}`,
        "---", "",
        "# Project Identity", "",
        info.description || `${info.name} — a ${info.language} project.`, "",
        "## Architecture", "",
        `- **Language**: ${info.language}${info.framework ? ` (${info.framework})` : ""}`,
        `- **Package manager**: ${info.packageManager || "N/A"}`,
        ...(info.entryPoint ? [`- **Entry point**: \`${info.entryPoint}\``] : []),
        ...(info.hasDocker ? ["- **Docker**: Yes"] : []),
        "",
        moduleTable, depTable, scriptsSection, ciSection,
    ].filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

// ── CONVENTIONS.md ──────────────────────────────────────────────

export function generateConventions(info: ProjectInfo, conv: ConventionInfo): string {
    const today = new Date().toISOString().split("T")[0];

    const buildCmds = conv.buildCommands.filter(Boolean).length ? [
        "## Build Commands", "", "```sh",
        ...conv.buildCommands.filter(Boolean), "```", "",
    ].join("\n") : "";

    const lintCmds = conv.lintCommands.length ? [
        "## Lint / Format", "", "```sh",
        ...conv.lintCommands, "```", "",
    ].join("\n") : "";

    return [
        "---", `updated: ${today}`, "scope: all-modules", "---", "",
        "# Coding Conventions", "",
        "## Language & Style", "",
        `- **Primary language**: ${conv.language}`,
        ...(conv.style ? [`- **Tooling**: ${conv.style.trim()}`] : []),
        ...(conv.naming ? [`- **Naming**: ${conv.naming}`] : []),
        ...(conv.imports ? [`- **Imports**: ${conv.imports}`] : []),
        "",
        ...(conv.testing ? [
            "## Testing", "",
            `- **Framework**: ${conv.testing}`,
            ...(info.testCommand ? [`- **Run**: \`${info.testCommand}\``] : []),
            "",
        ] : []),
        ...(conv.buildTool ? ["## Build", "", `- **Build tool**: ${conv.buildTool}`, ""] : []),
        buildCmds, lintCmds,
        "## File Organization", "", "```",
        ...conv.fileOrganization, "```", "",
        "## Gotchas", "",
        "<!-- Add known pitfalls, edge cases, and things that surprised you -->",
        "- _(none yet — agents will add these as they discover them)_", "",
    ].join("\n") + "\n";
}

// ── DECISIONS.md ────────────────────────────────────────────────

export function generateDecisions(info: ProjectInfo): string {
    const today = new Date().toISOString().split("T")[0];
    const decisions: string[] = [];

    if (info.language) {
        decisions.push([
            `## ADR-001: ${info.language} as primary language`, "",
            `**Decision**: Use ${info.language}${info.framework ? ` with ${info.framework}` : ""}.`, "",
            `**Why**: _(fill in the rationale)_`, "",
        ].join("\n"));
    }
    if (info.packageManager) {
        decisions.push([
            `## ADR-002: ${info.packageManager} as package manager`, "",
            `**Decision**: Use ${info.packageManager} for dependency management.`, "",
            `**Why**: _(fill in the rationale)_`, "",
        ].join("\n"));
    }

    return [
        "---", `updated: ${today}`, "format: ADR-lite", "---", "",
        "# Architectural Decisions", "",
        "<!-- Record key design decisions here. Each ADR should explain:",
        "     - What was decided", "     - Why (rationale)",
        "     - What was rejected and why -->", "",
        ...decisions,
        "---", "",
        "<!-- Add more ADRs as the project evolves. -->", "",
    ].join("\n") + "\n";
}

// ── SPEC.md ─────────────────────────────────────────────────────

export function generateSpec(): string {
    const today = new Date().toISOString().split("T")[0];
    return [
        "---", `version: "0.1"`, "status: draft", `updated: ${today}`, "---", "",
        "# `.ai/` Directory Specification", "",
        "An open standard for agent-persistent project memory.", "",
        "**Full spec**: https://github.com/Harkirat155/ai-native", "",
        "## Structure", "", "```", ".ai/",
        "├── IDENTITY.md       # L1: Project DNA (always loaded)",
        "├── CONVENTIONS.md    # L1: Coding patterns & rules",
        "├── DECISIONS.md      # L1: Architectural decisions",
        "├── SPEC.md           # This file",
        "├── memory/           # L2: On-demand knowledge items",
        "└── journal/          # L2: Session summaries", "```", "",
        "**Layer 1**: Always loaded at session start (< 2000 tokens combined).",
        "**Layer 2**: Searched on-demand by topic/tags.", "",
        "## For agents", "",
        "1. Load IDENTITY.md + CONVENTIONS.md + DECISIONS.md at session start",
        "2. Search `memory/` when encountering unfamiliar areas",
        "3. Write to `journal/` and `memory/` at session end", "",
    ].join("\n") + "\n";
}
