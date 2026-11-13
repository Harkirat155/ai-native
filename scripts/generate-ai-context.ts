#!/usr/bin/env node
/**
 * generate-ai-context.ts
 *
 * Auto-generates `.ai/IDENTITY.md`, `.ai/CONVENTIONS.md`, and `.ai/DECISIONS.md`
 * by analyzing the project's manifest files, directory structure, and code patterns.
 *
 * Usage:
 *   npx tsx scripts/generate-ai-context.ts [--root /path/to/project] [--force]
 *
 * Supports: Node.js, Python, Go, Rust, Ruby, Java, .NET, and generic projects.
 */

import { readFile, readdir, writeFile, mkdir, stat, access } from "node:fs/promises";
import path from "node:path";

// ── CLI args ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (key: string) => {
    const idx = args.indexOf(key);
    return idx >= 0 ? args[idx + 1] : undefined;
};
const hasFlag = (key: string) => args.includes(key);

const ROOT = path.resolve(getArg("--root") ?? ".");
const FORCE = hasFlag("--force");
const AI_DIR = path.join(ROOT, ".ai");

// ── Types ───────────────────────────────────────────────────────

interface ProjectInfo {
    name: string;
    description: string;
    version: string;
    license: string;
    repo: string;
    author: string;
    language: string;
    framework: string;
    packageManager: string;
    buildCommand: string;
    testCommand: string;
    entryPoint: string;
    modules: ModuleInfo[];
    dependencies: DepInfo[];
    scripts: Record<string, string>;
    ciFiles: string[];
    hasDocker: boolean;
    hasTests: boolean;
}

interface ModuleInfo {
    name: string;
    path: string;
    role: string;
    entry: string;
}

interface DepInfo {
    name: string;
    where: string;
    purpose: string;
}

interface ConventionInfo {
    language: string;
    style: string;
    naming: string;
    imports: string;
    testing: string;
    buildTool: string;
    buildCommands: string[];
    lintCommands: string[];
    fileOrganization: string[];
    gotchas: string[];
}

// ── File detection helpers ──────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function readJson(filePath: string): Promise<any> {
    try {
        return JSON.parse(await readFile(filePath, "utf8"));
    } catch {
        return null;
    }
}

async function readText(filePath: string): Promise<string | null> {
    try {
        return await readFile(filePath, "utf8");
    } catch {
        return null;
    }
}

async function listTopLevel(): Promise<string[]> {
    try {
        const entries = await readdir(ROOT, { withFileTypes: true });
        return entries
            .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    } catch {
        return [];
    }
}

async function countFiles(dir: string, ext: string): Promise<number> {
    let count = 0;
    try {
        const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true, recursive: true });
        for (const e of entries) {
            if (e.isFile() && e.name.endsWith(ext)) count++;
        }
    } catch { /* ignore */ }
    return count;
}

async function findDirs(names: string[]): Promise<string[]> {
    const found: string[] = [];
    for (const name of names) {
        if (await fileExists(path.join(ROOT, name))) found.push(name);
    }
    return found;
}

// ── Detect project type ─────────────────────────────────────────

async function detectProject(): Promise<ProjectInfo> {
    const info: ProjectInfo = {
        name: path.basename(ROOT),
        description: "",
        version: "0.0.0",
        license: "",
        repo: "",
        author: "",
        language: "unknown",
        framework: "",
        packageManager: "",
        buildCommand: "",
        testCommand: "",
        entryPoint: "",
        modules: [],
        dependencies: [],
        scripts: {},
        ciFiles: [],
        hasDocker: false,
        hasTests: false,
    };

    // ── Node.js / TypeScript ──
    const pkg = await readJson(path.join(ROOT, "package.json"));
    if (pkg) {
        info.name = pkg.name ?? info.name;
        info.description = pkg.description ?? "";
        info.version = pkg.version ?? "0.0.0";
        info.license = pkg.license ?? "";
        info.repo = typeof pkg.repository === "string"
            ? pkg.repository
            : pkg.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, "") ?? "";
        info.author = typeof pkg.author === "string" ? pkg.author : pkg.author?.name ?? "";
        info.scripts = pkg.scripts ?? {};

        const hasTsConfig = await fileExists(path.join(ROOT, "tsconfig.json"));
        info.language = hasTsConfig ? "TypeScript" : "JavaScript";
        info.packageManager = (await fileExists(path.join(ROOT, "yarn.lock")))
            ? "yarn"
            : (await fileExists(path.join(ROOT, "pnpm-lock.yaml")))
                ? "pnpm"
                : "npm";

        info.buildCommand = info.scripts.build ? `${info.packageManager} run build` : "";
        info.testCommand = info.scripts.test ? `${info.packageManager} test` : "";
        info.entryPoint = pkg.main ?? "index.js";

        // Detect framework
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (allDeps.next) info.framework = "Next.js";
        else if (allDeps.nuxt) info.framework = "Nuxt";
        else if (allDeps.vite) info.framework = "Vite";
        else if (allDeps.react) info.framework = "React";
        else if (allDeps.vue) info.framework = "Vue";
        else if (allDeps.express) info.framework = "Express";
        else if (allDeps.fastify) info.framework = "Fastify";
        else if (allDeps.hono) info.framework = "Hono";
        else if (allDeps["@nestjs/core"]) info.framework = "NestJS";

        // Top dependencies
        const topDeps = Object.keys(pkg.dependencies ?? {}).slice(0, 12);
        for (const dep of topDeps) {
            info.dependencies.push({ name: dep, where: "dependencies", purpose: "" });
        }

        // npm workspaces
        if (pkg.workspaces) {
            const workspaceList = Array.isArray(pkg.workspaces)
                ? pkg.workspaces
                : pkg.workspaces.packages ?? [];
            for (const ws of workspaceList) {
                const wsPath = ws.replace(/\/?\*?$/, "");
                const wsPkg = await readJson(path.join(ROOT, wsPath, "package.json"));
                info.modules.push({
                    name: wsPkg?.name ?? wsPath,
                    path: `${wsPath}/`,
                    role: wsPkg?.description ?? "",
                    entry: wsPkg?.main ?? "src/index.ts",
                });
            }
        }
    }

    // ── Python ──
    const pyproject = await readText(path.join(ROOT, "pyproject.toml"));
    if (pyproject && !pkg) {
        info.language = "Python";
        info.packageManager = pyproject.includes("[tool.poetry]") ? "poetry" : "pip";
        const nameMatch = pyproject.match(/^name\s*=\s*"(.+)"/m);
        if (nameMatch) info.name = nameMatch[1];
        const descMatch = pyproject.match(/^description\s*=\s*"(.+)"/m);
        if (descMatch) info.description = descMatch[1];
        const versionMatch = pyproject.match(/^version\s*=\s*"(.+)"/m);
        if (versionMatch) info.version = versionMatch[1];
        info.buildCommand = info.packageManager === "poetry" ? "poetry build" : "python -m build";
        info.testCommand = "pytest";
    }

    const setupPy = await fileExists(path.join(ROOT, "setup.py"));
    if (setupPy && !pkg && !pyproject) {
        info.language = "Python";
        info.packageManager = "pip";
        info.testCommand = "pytest";
    }

    // ── Go ──
    const goMod = await readText(path.join(ROOT, "go.mod"));
    if (goMod) {
        info.language = "Go";
        info.packageManager = "go modules";
        const modName = goMod.match(/^module\s+(.+)/m);
        if (modName) info.name = modName[1];
        info.buildCommand = "go build ./...";
        info.testCommand = "go test ./...";
    }

    // ── Rust ──
    const cargoToml = await readText(path.join(ROOT, "Cargo.toml"));
    if (cargoToml) {
        info.language = "Rust";
        info.packageManager = "cargo";
        const nameMatch = cargoToml.match(/^name\s*=\s*"(.+)"/m);
        if (nameMatch) info.name = nameMatch[1];
        info.buildCommand = "cargo build";
        info.testCommand = "cargo test";
    }

    // ── Detect modules from directory structure ──
    if (info.modules.length === 0) {
        const commonDirs = ["src", "lib", "pkg", "internal", "cmd", "app", "api",
            "server", "client", "core", "utils", "services", "models",
            "controllers", "routes", "middleware", "config", "tests",
            "scripts", "docs", "examples", "tools", "plugins"];
        const found = await findDirs(commonDirs);
        for (const dir of found) {
            if (dir === "node_modules") continue;
            info.modules.push({
                name: dir,
                path: `${dir}/`,
                role: inferDirRole(dir),
                entry: "",
            });
        }
    }

    // ── CI/CD ──
    const ciDirs = [".github/workflows", ".gitlab-ci.yml", ".circleci", "Jenkinsfile"];
    for (const ci of ciDirs) {
        if (await fileExists(path.join(ROOT, ci))) {
            if (ci === ".github/workflows") {
                try {
                    const workflows = await readdir(path.join(ROOT, ci));
                    info.ciFiles.push(...workflows.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).map((f) => `.github/workflows/${f}`));
                } catch { /* ignore */ }
            } else {
                info.ciFiles.push(ci);
            }
        }
    }

    // ── Docker ──
    info.hasDocker = (await fileExists(path.join(ROOT, "Dockerfile"))) ||
        (await fileExists(path.join(ROOT, "docker-compose.yml")));

    // ── Tests ──
    const testDirs = ["tests", "test", "__tests__", "spec", "src/__tests__"];
    info.hasTests = (await findDirs(testDirs)).length > 0;

    // ── README for description ──
    if (!info.description) {
        const readme = await readText(path.join(ROOT, "README.md"));
        if (readme) {
            // Extract first non-heading, non-empty paragraph
            const lines = readme.split("\n");
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("```") && !trimmed.startsWith("!")) {
                    info.description = trimmed.slice(0, 200);
                    break;
                }
            }
        }
    }

    // ── License ──
    if (!info.license && (await fileExists(path.join(ROOT, "LICENSE")))) {
        const licText = await readText(path.join(ROOT, "LICENSE"));
        if (licText) {
            if (licText.includes("MIT")) info.license = "MIT";
            else if (licText.includes("Apache")) info.license = "Apache-2.0";
            else if (licText.includes("GNU GENERAL PUBLIC")) info.license = "GPL-3.0";
            else if (licText.includes("BSD")) info.license = "BSD-3-Clause";
            else info.license = "See LICENSE file";
        }
    }

    // ── Git repo ──
    if (!info.repo) {
        const gitConfig = await readText(path.join(ROOT, ".git/config"));
        if (gitConfig) {
            const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
            if (urlMatch) {
                info.repo = urlMatch[1].trim()
                    .replace(/^git@github\.com:/, "https://github.com/")
                    .replace(/\.git$/, "");
            }
        }
    }

    return info;
}

function inferDirRole(dir: string): string {
    const roles: Record<string, string> = {
        src: "Source code",
        lib: "Library code",
        pkg: "Package modules",
        internal: "Internal packages (not exported)",
        cmd: "CLI entry points",
        app: "Application logic",
        api: "API routes / handlers",
        server: "Server implementation",
        client: "Client implementation",
        core: "Core business logic",
        utils: "Utility functions",
        services: "Service layer",
        models: "Data models / schemas",
        controllers: "Request controllers",
        routes: "Route definitions",
        middleware: "Middleware functions",
        config: "Configuration",
        tests: "Test files",
        scripts: "Build / utility scripts",
        docs: "Documentation",
        examples: "Example code / usage demos",
        tools: "Developer tooling",
        plugins: "Plugin / extension modules",
    };
    return roles[dir] ?? "";
}

// ── Detect conventions ──────────────────────────────────────────

async function detectConventions(info: ProjectInfo): Promise<ConventionInfo> {
    const conv: ConventionInfo = {
        language: info.language,
        style: "",
        naming: "",
        imports: "",
        testing: "",
        buildTool: "",
        buildCommands: [],
        lintCommands: [],
        fileOrganization: [],
        gotchas: [],
    };

    const pkg = await readJson(path.join(ROOT, "package.json"));
    if (pkg) {
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

        // Style detection
        if (allDeps.prettier) conv.style += "Prettier for formatting. ";
        if (allDeps.eslint) conv.style += "ESLint for linting. ";
        if (allDeps.biome) conv.style += "Biome for formatting + linting. ";
        if (allDeps.oxlint) conv.style += "oxlint for linting. ";

        // TypeScript config
        const tsConfig = await readJson(path.join(ROOT, "tsconfig.json"));
        if (tsConfig) {
            const strict = tsConfig.compilerOptions?.strict;
            const target = tsConfig.compilerOptions?.target ?? "unknown";
            conv.style += `TypeScript (${strict ? "strict" : "non-strict"}, target: ${target}). `;
        }

        // Test framework
        if (allDeps.jest) conv.testing = "Jest";
        else if (allDeps.vitest) conv.testing = "Vitest";
        else if (allDeps.mocha) conv.testing = "Mocha";
        else if (allDeps.ava) conv.testing = "Ava";
        else if (allDeps["@playwright/test"]) conv.testing = "Playwright";
        else if (allDeps.cypress) conv.testing = "Cypress";

        // Build tool
        if (allDeps.esbuild) conv.buildTool = "esbuild";
        else if (allDeps.webpack) conv.buildTool = "webpack";
        else if (allDeps.rollup) conv.buildTool = "rollup";
        else if (allDeps.vite) conv.buildTool = "Vite";
        else if (allDeps.turbopack) conv.buildTool = "Turbopack";
        else if (allDeps.tsup) conv.buildTool = "tsup";
        else if (allDeps.swc) conv.buildTool = "SWC";

        // Build commands
        if (info.scripts.build) conv.buildCommands.push(`${info.packageManager} run build`);
        if (info.scripts.dev) conv.buildCommands.push(`${info.packageManager} run dev`);
        if (info.scripts.start) conv.buildCommands.push(`${info.packageManager} start`);
        if (info.scripts.test) conv.buildCommands.push(`${info.packageManager} test`);
        if (info.scripts.typecheck) conv.buildCommands.push(`${info.packageManager} run typecheck`);

        // Lint commands
        if (info.scripts.lint) conv.lintCommands.push(`${info.packageManager} run lint`);
        if (info.scripts.format) conv.lintCommands.push(`${info.packageManager} run format`);
    }

    // Python conventions
    if (info.language === "Python") {
        const pyproject = await readText(path.join(ROOT, "pyproject.toml"));
        if (pyproject) {
            if (pyproject.includes("[tool.ruff]")) conv.style += "Ruff for linting + formatting. ";
            if (pyproject.includes("[tool.black]")) conv.style += "Black for formatting. ";
            if (pyproject.includes("[tool.mypy]")) conv.style += "mypy for type checking. ";
            if (pyproject.includes("[tool.pytest]") || pyproject.includes("pytest")) conv.testing = "pytest";
        }
        conv.buildCommands.push(info.buildCommand);
        conv.buildCommands.push(info.testCommand);
    }

    // Go conventions
    if (info.language === "Go") {
        conv.style = "gofmt for formatting. ";
        conv.testing = "go test";
        if (await fileExists(path.join(ROOT, ".golangci.yml"))) conv.style += "golangci-lint. ";
        conv.buildCommands.push("go build ./...", "go test ./...");
    }

    // Rust conventions
    if (info.language === "Rust") {
        conv.style = "rustfmt for formatting, clippy for linting. ";
        conv.testing = "cargo test";
        conv.buildCommands.push("cargo build", "cargo test", "cargo clippy");
    }

    // Naming conventions (heuristic from language)
    switch (info.language) {
        case "TypeScript":
        case "JavaScript":
            conv.naming = "camelCase for functions/variables, PascalCase for types/classes, UPPER_SNAKE for constants";
            conv.imports = "ES modules (import/export)";
            break;
        case "Python":
            conv.naming = "snake_case for functions/variables, PascalCase for classes, UPPER_SNAKE for constants";
            conv.imports = "PEP 8 import ordering (stdlib → third-party → local)";
            break;
        case "Go":
            conv.naming = "camelCase for unexported, PascalCase for exported, short variable names";
            conv.imports = "goimports grouping (stdlib → third-party → local)";
            break;
        case "Rust":
            conv.naming = "snake_case for functions/variables, PascalCase for types/traits, UPPER_SNAKE for constants";
            conv.imports = "use declarations grouped by crate";
            break;
    }

    // File org
    const topLevel = await listTopLevel();
    conv.fileOrganization = topLevel.slice(0, 20);

    return conv;
}

// ── Generate IDENTITY.md ────────────────────────────────────────

function generateIdentity(info: ProjectInfo): string {
    const today = new Date().toISOString().split("T")[0];

    const moduleTable = info.modules.length
        ? [
            "## Module Map",
            "",
            "| Module | Path | Role |",
            "|--------|------|------|",
            ...info.modules.map((m) => `| **${m.name}** | \`${m.path}\` | ${m.role} |`),
            "",
        ].join("\n")
        : "";

    const depTable = info.dependencies.length
        ? [
            "## Key Dependencies",
            "",
            "| Dependency | Purpose |",
            "|-----------|---------|",
            ...info.dependencies.map((d) => `| \`${d.name}\` | ${d.purpose || "(auto-detected)"} |`),
            "",
        ].join("\n")
        : "";

    const scriptsSection = Object.keys(info.scripts).length
        ? [
            "## Scripts",
            "",
            "```sh",
            ...Object.entries(info.scripts).slice(0, 15).map(([k, v]) => `${info.packageManager} run ${k}  # ${v}`),
            "```",
            "",
        ].join("\n")
        : "";

    const ciSection = info.ciFiles.length
        ? [
            "## CI/CD",
            "",
            ...info.ciFiles.map((f) => `- \`${f}\``),
            "",
        ].join("\n")
        : "";

    return [
        "---",
        `project: ${info.name}`,
        `version: ${info.version}`,
        ...(info.license ? [`license: ${info.license}`] : []),
        ...(info.repo ? [`repo: ${info.repo}`] : []),
        ...(info.author ? [`author: ${info.author}`] : []),
        `updated: ${today}`,
        "---",
        "",
        "# Project Identity",
        "",
        info.description || `${info.name} — a ${info.language} project.`,
        "",
        "## Architecture",
        "",
        `- **Language**: ${info.language}${info.framework ? ` (${info.framework})` : ""}`,
        `- **Package manager**: ${info.packageManager || "N/A"}`,
        ...(info.entryPoint ? [`- **Entry point**: \`${info.entryPoint}\``] : []),
        ...(info.hasDocker ? ["- **Docker**: Yes"] : []),
        "",
        moduleTable,
        depTable,
        scriptsSection,
        ciSection,
    ]
        .filter(Boolean)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n") + "\n";
}

// ── Generate CONVENTIONS.md ─────────────────────────────────────

function generateConventions(info: ProjectInfo, conv: ConventionInfo): string {
    const today = new Date().toISOString().split("T")[0];

    const buildCmds = conv.buildCommands.length
        ? [
            "## Build Commands",
            "",
            "```sh",
            ...conv.buildCommands,
            "```",
            "",
        ].join("\n")
        : "";

    const lintCmds = conv.lintCommands.length
        ? [
            "## Lint / Format",
            "",
            "```sh",
            ...conv.lintCommands,
            "```",
            "",
        ].join("\n")
        : "";

    return [
        "---",
        `updated: ${today}`,
        "scope: all-modules",
        "---",
        "",
        "# Coding Conventions",
        "",
        "## Language & Style",
        "",
        `- **Primary language**: ${conv.language}`,
        ...(conv.style ? [`- **Tooling**: ${conv.style.trim()}`] : []),
        ...(conv.naming ? [`- **Naming**: ${conv.naming}`] : []),
        ...(conv.imports ? [`- **Imports**: ${conv.imports}`] : []),
        "",
        ...(conv.testing ? [
            "## Testing",
            "",
            `- **Framework**: ${conv.testing}`,
            ...(info.testCommand ? [`- **Run**: \`${info.testCommand}\``] : []),
            "",
        ] : []),
        ...(conv.buildTool ? [
            "## Build",
            "",
            `- **Build tool**: ${conv.buildTool}`,
            "",
        ] : []),
        buildCmds,
        lintCmds,
        "## File Organization",
        "",
        "```",
        ...conv.fileOrganization.map((f) => f),
        "```",
        "",
        "## Gotchas",
        "",
        "<!-- Add known pitfalls, edge cases, and things that surprised you -->",
        "- _(none yet — agents will add these as they discover them)_",
        "",
    ].join("\n") + "\n";
}

// ── Generate DECISIONS.md ───────────────────────────────────────

function generateDecisions(info: ProjectInfo): string {
    const today = new Date().toISOString().split("T")[0];

    const decisions: string[] = [];

    if (info.language) {
        decisions.push([
            `## ADR-001: ${info.language} as primary language`,
            "",
            `**Decision**: Use ${info.language}${info.framework ? ` with ${info.framework}` : ""}.`,
            "",
            `**Why**: _(fill in the rationale)_`,
            "",
        ].join("\n"));
    }

    if (info.packageManager) {
        decisions.push([
            `## ADR-002: ${info.packageManager} as package manager`,
            "",
            `**Decision**: Use ${info.packageManager} for dependency management.`,
            "",
            `**Why**: _(fill in the rationale)_`,
            "",
        ].join("\n"));
    }

    return [
        "---",
        `updated: ${today}`,
        "format: ADR-lite",
        "---",
        "",
        "# Architectural Decisions",
        "",
        "<!-- Record key design decisions here. Each ADR should explain:",
        "     - What was decided",
        "     - Why (rationale)",
        "     - What was rejected and why -->",
        "",
        ...decisions,
        "---",
        "",
        "<!-- Add more ADRs as the project evolves. Agents will suggest new ADRs",
        "     when they encounter decisions that should be documented. -->",
        "",
    ].join("\n") + "\n";
}

// ── Generate SPEC.md (copy from template) ───────────────────────

function generateSpec(): string {
    const today = new Date().toISOString().split("T")[0];
    return [
        "---",
        `version: "0.1"`,
        "status: draft",
        `updated: ${today}`,
        "---",
        "",
        "# `.ai/` Directory Specification",
        "",
        "See https://github.com/Harkirat155/ai-native for the full spec.",
        "",
        "## Structure",
        "",
        "```",
        ".ai/",
        "├── IDENTITY.md       # L1: Project DNA (always loaded)",
        "├── CONVENTIONS.md    # L1: Coding patterns & rules",
        "├── DECISIONS.md      # L1: Architectural decisions",
        "├── SPEC.md           # This file",
        "├── memory/           # L2: On-demand knowledge items",
        "└── journal/          # L2: Session summaries",
        "```",
        "",
        "**Layer 1**: Always loaded at session start (< 2000 tokens combined).",
        "**Layer 2**: Searched on-demand by topic/tags.",
        "",
        "## For agents",
        "",
        "1. Load IDENTITY.md + CONVENTIONS.md + DECISIONS.md at session start",
        "2. Search memory/ when encountering unfamiliar areas",
        "3. Write to journal/ and memory/ at session end",
        "",
    ].join("\n") + "\n";
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🧠 Generating .ai/ context for: ${ROOT}\n`);

    // Detect project
    const info = await detectProject();
    console.log(`  📦 Project: ${info.name} (${info.language}${info.framework ? ` / ${info.framework}` : ""})`);
    console.log(`  📁 Modules: ${info.modules.length} detected`);
    console.log(`  📋 Dependencies: ${info.dependencies.length} found`);
    console.log(`  🔧 CI files: ${info.ciFiles.length} found`);

    // Detect conventions
    const conv = await detectConventions(info);
    console.log(`  🎨 Style: ${conv.style || "(none detected)"}`);
    console.log(`  🧪 Testing: ${conv.testing || "(none detected)"}`);
    console.log(`  🔨 Build: ${conv.buildTool || "(default)"}`);

    // Check if .ai/ already exists
    if (await fileExists(AI_DIR) && !FORCE) {
        console.log(`\n⚠️  .ai/ already exists. Use --force to overwrite.\n`);
        process.exit(1);
    }

    // Create directories
    await mkdir(path.join(AI_DIR, "memory"), { recursive: true });
    await mkdir(path.join(AI_DIR, "journal"), { recursive: true });

    // Generate files
    const files = [
        { name: "IDENTITY.md", content: generateIdentity(info) },
        { name: "CONVENTIONS.md", content: generateConventions(info, conv) },
        { name: "DECISIONS.md", content: generateDecisions(info) },
        { name: "SPEC.md", content: generateSpec() },
    ];

    for (const file of files) {
        const filePath = path.join(AI_DIR, file.name);
        await writeFile(filePath, file.content, "utf8");
        const bytes = Buffer.byteLength(file.content);
        console.log(`  ✅ ${file.name} (${bytes} bytes)`);
    }

    // Summary
    const totalBytes = files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
    const estimatedTokens = Math.round(totalBytes / 4); // rough token estimate

    console.log(`\n✨ Done! Created .ai/ with ${files.length} files (${totalBytes} bytes, ~${estimatedTokens} tokens)`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review and enrich the generated files (especially DECISIONS.md)`);
    console.log(`   2. Add knowledge items to .ai/memory/ as you learn about the project`);
    console.log(`   3. Commit .ai/ to version control`);
    console.log("");
}

main().catch((e) => {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
});
