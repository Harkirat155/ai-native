/**
 * detector.ts — Detect project type, framework, tooling, and structure.
 *
 * Reads manifests (package.json, pyproject.toml, go.mod, Cargo.toml) and
 * file system to build a ProjectInfo snapshot. Pure I/O, no opinions.
 */

import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";

// ── Types ───────────────────────────────────────────────────────

export interface ProjectInfo {
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

export interface ModuleInfo {
    name: string;
    path: string;
    role: string;
    entry: string;
}

export interface DepInfo {
    name: string;
    where: string;
    purpose: string;
}

export interface ConventionInfo {
    language: string;
    style: string;
    naming: string;
    imports: string;
    testing: string;
    buildTool: string;
    buildCommands: string[];
    lintCommands: string[];
    fileOrganization: string[];
}

// ── Helpers ─────────────────────────────────────────────────────

async function exists(filePath: string): Promise<boolean> {
    try { await access(filePath); return true; } catch { return false; }
}

async function readJson(filePath: string): Promise<any> {
    try { return JSON.parse(await readFile(filePath, "utf8")); } catch { return null; }
}

async function readText(filePath: string): Promise<string | null> {
    try { return await readFile(filePath, "utf8"); } catch { return null; }
}

async function findDirs(root: string, names: string[]): Promise<string[]> {
    const found: string[] = [];
    for (const n of names) if (await exists(path.join(root, n))) found.push(n);
    return found;
}

const DIR_ROLES: Record<string, string> = {
    src: "Source code", lib: "Library code", pkg: "Package modules",
    internal: "Internal packages (not exported)", cmd: "CLI entry points",
    app: "Application logic", api: "API routes / handlers",
    server: "Server implementation", client: "Client implementation",
    core: "Core business logic", utils: "Utility functions",
    services: "Service layer", models: "Data models / schemas",
    controllers: "Request controllers", routes: "Route definitions",
    middleware: "Middleware functions", config: "Configuration",
    tests: "Test files", scripts: "Build / utility scripts",
    docs: "Documentation", examples: "Example code / usage demos",
    tools: "Developer tooling", plugins: "Plugin / extension modules",
    extension: "Extension / plugin code", protocol: "Protocol definitions",
    website: "Web frontend / docs site",
};

// ── Detect ──────────────────────────────────────────────────────

export async function detectProject(root: string): Promise<ProjectInfo> {
    const info: ProjectInfo = {
        name: path.basename(root), description: "", version: "0.0.0",
        license: "", repo: "", author: "", language: "unknown",
        framework: "", packageManager: "", buildCommand: "", testCommand: "",
        entryPoint: "", modules: [], dependencies: [], scripts: {},
        ciFiles: [], hasDocker: false, hasTests: false,
    };

    // ── Node.js / TypeScript ──
    const pkg = await readJson(path.join(root, "package.json"));
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

        info.language = (await exists(path.join(root, "tsconfig.json"))) ? "TypeScript" : "JavaScript";
        info.packageManager = (await exists(path.join(root, "yarn.lock"))) ? "yarn"
            : (await exists(path.join(root, "pnpm-lock.yaml"))) ? "pnpm" : "npm";

        info.buildCommand = info.scripts.build ? `${info.packageManager} run build` : "";
        info.testCommand = info.scripts.test ? `${info.packageManager} test` : "";
        info.entryPoint = pkg.main ?? "index.js";

        // Framework
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const fwMap: [string, string][] = [
            ["next", "Next.js"], ["nuxt", "Nuxt"], ["vite", "Vite"],
            ["react", "React"], ["vue", "Vue"], ["express", "Express"],
            ["fastify", "Fastify"], ["hono", "Hono"], ["@nestjs/core", "NestJS"],
        ];
        for (const [dep, fw] of fwMap) {
            if (allDeps[dep]) { info.framework = fw; break; }
        }

        // Dependencies
        for (const dep of Object.keys(pkg.dependencies ?? {}).slice(0, 15)) {
            info.dependencies.push({ name: dep, where: "dependencies", purpose: "" });
        }

        // Workspaces
        if (pkg.workspaces) {
            const list = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages ?? [];
            for (const ws of list) {
                const wsPath = ws.replace(/\/?\*?$/, "");
                const wsPkg = await readJson(path.join(root, wsPath, "package.json"));
                info.modules.push({
                    name: wsPkg?.name ?? wsPath, path: `${wsPath}/`,
                    role: wsPkg?.description ?? DIR_ROLES[wsPath] ?? "", entry: wsPkg?.main ?? "",
                });
            }
        }
    }

    // ── Python ──
    const pyproject = await readText(path.join(root, "pyproject.toml"));
    if (pyproject && !pkg) {
        info.language = "Python";
        info.packageManager = pyproject.includes("[tool.poetry]") ? "poetry" : "pip";
        const nm = pyproject.match(/^name\s*=\s*"(.+)"/m);
        if (nm) info.name = nm[1];
        const desc = pyproject.match(/^description\s*=\s*"(.+)"/m);
        if (desc) info.description = desc[1];
        const ver = pyproject.match(/^version\s*=\s*"(.+)"/m);
        if (ver) info.version = ver[1];
        info.buildCommand = info.packageManager === "poetry" ? "poetry build" : "python -m build";
        info.testCommand = "pytest";
    }
    if ((await exists(path.join(root, "setup.py"))) && !pkg && !pyproject) {
        info.language = "Python"; info.packageManager = "pip"; info.testCommand = "pytest";
    }

    // ── Go ──
    const goMod = await readText(path.join(root, "go.mod"));
    if (goMod) {
        info.language = "Go"; info.packageManager = "go modules";
        const m = goMod.match(/^module\s+(.+)/m);
        if (m) info.name = m[1];
        info.buildCommand = "go build ./..."; info.testCommand = "go test ./...";
    }

    // ── Rust ──
    const cargo = await readText(path.join(root, "Cargo.toml"));
    if (cargo) {
        info.language = "Rust"; info.packageManager = "cargo";
        const nm = cargo.match(/^name\s*=\s*"(.+)"/m);
        if (nm) info.name = nm[1];
        info.buildCommand = "cargo build"; info.testCommand = "cargo test";
    }

    // ── Modules from directories ──
    if (info.modules.length === 0) {
        const found = await findDirs(root, Object.keys(DIR_ROLES));
        for (const dir of found) {
            info.modules.push({ name: dir, path: `${dir}/`, role: DIR_ROLES[dir] ?? "", entry: "" });
        }
    }

    // ── CI/CD ──
    if (await exists(path.join(root, ".github/workflows"))) {
        try {
            const wfs = await readdir(path.join(root, ".github/workflows"));
            info.ciFiles.push(...wfs.filter(f => f.endsWith(".yml") || f.endsWith(".yaml")).map(f => `.github/workflows/${f}`));
        } catch { /* ignore */ }
    }
    for (const ci of [".gitlab-ci.yml", ".circleci/config.yml", "Jenkinsfile"]) {
        if (await exists(path.join(root, ci))) info.ciFiles.push(ci);
    }

    // ── Docker ──
    info.hasDocker = (await exists(path.join(root, "Dockerfile"))) || (await exists(path.join(root, "docker-compose.yml")));

    // ── Tests ──
    info.hasTests = (await findDirs(root, ["tests", "test", "__tests__", "spec"])).length > 0;

    // ── README description ──
    if (!info.description) {
        const readme = await readText(path.join(root, "README.md"));
        if (readme) {
            for (const line of readme.split("\n")) {
                const t = line.trim();
                if (t && !t.startsWith("#") && !t.startsWith("```") && !t.startsWith("!")) {
                    info.description = t.slice(0, 200); break;
                }
            }
        }
    }

    // ── License ──
    if (!info.license && (await exists(path.join(root, "LICENSE")))) {
        const lic = await readText(path.join(root, "LICENSE"));
        if (lic) {
            if (lic.includes("MIT")) info.license = "MIT";
            else if (lic.includes("Apache")) info.license = "Apache-2.0";
            else if (lic.includes("GNU GENERAL PUBLIC")) info.license = "GPL-3.0";
            else if (lic.includes("BSD")) info.license = "BSD-3-Clause";
        }
    }

    // ── Git repo ──
    if (!info.repo) {
        const cfg = await readText(path.join(root, ".git/config"));
        if (cfg) {
            const m = cfg.match(/url\s*=\s*(.+)/);
            if (m) info.repo = m[1].trim().replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "");
        }
    }

    return info;
}

// ── Detect conventions ──────────────────────────────────────────

export async function detectConventions(root: string, info: ProjectInfo): Promise<ConventionInfo> {
    const conv: ConventionInfo = {
        language: info.language, style: "", naming: "", imports: "",
        testing: "", buildTool: "", buildCommands: [], lintCommands: [],
        fileOrganization: [],
    };

    const pkg = await readJson(path.join(root, "package.json"));
    if (pkg) {
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

        if (allDeps.prettier) conv.style += "Prettier for formatting. ";
        if (allDeps.eslint) conv.style += "ESLint for linting. ";
        if (allDeps.biome) conv.style += "Biome for formatting + linting. ";

        const tsConfig = await readJson(path.join(root, "tsconfig.json"));
        if (tsConfig) {
            const strict = tsConfig.compilerOptions?.strict;
            const target = tsConfig.compilerOptions?.target ?? "unknown";
            conv.style += `TypeScript (${strict ? "strict" : "non-strict"}, target: ${target}). `;
        }

        const testMap: [string, string][] = [
            ["jest", "Jest"], ["vitest", "Vitest"], ["mocha", "Mocha"],
            ["ava", "Ava"], ["@playwright/test", "Playwright"], ["cypress", "Cypress"],
        ];
        for (const [dep, name] of testMap) { if (allDeps[dep]) { conv.testing = name; break; } }

        const buildMap: [string, string][] = [
            ["esbuild", "esbuild"], ["webpack", "webpack"], ["rollup", "rollup"],
            ["vite", "Vite"], ["tsup", "tsup"], ["swc", "SWC"],
        ];
        for (const [dep, name] of buildMap) { if (allDeps[dep]) { conv.buildTool = name; break; } }

        if (info.scripts.build) conv.buildCommands.push(`${info.packageManager} run build`);
        if (info.scripts.dev) conv.buildCommands.push(`${info.packageManager} run dev`);
        if (info.scripts.test) conv.buildCommands.push(`${info.packageManager} test`);
        if (info.scripts.typecheck) conv.buildCommands.push(`${info.packageManager} run typecheck`);
        if (info.scripts.lint) conv.lintCommands.push(`${info.packageManager} run lint`);
        if (info.scripts.format) conv.lintCommands.push(`${info.packageManager} run format`);
    }

    // Python
    if (info.language === "Python") {
        const py = await readText(path.join(root, "pyproject.toml"));
        if (py) {
            if (py.includes("[tool.ruff]")) conv.style += "Ruff for linting + formatting. ";
            if (py.includes("[tool.black]")) conv.style += "Black for formatting. ";
            if (py.includes("[tool.mypy]")) conv.style += "mypy for type checking. ";
            if (py.includes("pytest")) conv.testing = "pytest";
        }
        conv.buildCommands.push(info.buildCommand, info.testCommand);
    }

    // Go
    if (info.language === "Go") {
        conv.style = "gofmt for formatting. ";
        conv.testing = "go test";
        if (await exists(path.join(root, ".golangci.yml"))) conv.style += "golangci-lint. ";
        conv.buildCommands.push("go build ./...", "go test ./...");
    }

    // Rust
    if (info.language === "Rust") {
        conv.style = "rustfmt for formatting, clippy for linting. ";
        conv.testing = "cargo test";
        conv.buildCommands.push("cargo build", "cargo test", "cargo clippy");
    }

    // Naming
    const namingMap: Record<string, [string, string]> = {
        TypeScript: ["camelCase for functions/variables, PascalCase for types/classes, UPPER_SNAKE for constants", "ES modules (import/export)"],
        JavaScript: ["camelCase for functions/variables, PascalCase for classes, UPPER_SNAKE for constants", "ES modules or CommonJS"],
        Python: ["snake_case for functions/variables, PascalCase for classes, UPPER_SNAKE for constants", "PEP 8 import ordering (stdlib → third-party → local)"],
        Go: ["camelCase for unexported, PascalCase for exported, short variable names", "goimports grouping (stdlib → third-party → local)"],
        Rust: ["snake_case for functions/variables, PascalCase for types/traits, UPPER_SNAKE for constants", "use declarations grouped by crate"],
    };
    const found = namingMap[info.language];
    if (found) { conv.naming = found[0]; conv.imports = found[1]; }

    // File organization
    try {
        const entries = await readdir(root, { withFileTypes: true });
        conv.fileOrganization = entries
            .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
            .map(e => e.isDirectory() ? `${e.name}/` : e.name)
            .slice(0, 20);
    } catch { /* ignore */ }

    return conv;
}
