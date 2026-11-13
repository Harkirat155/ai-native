# ai-context

**Give AI agents instant project memory.** One command to bootstrap a `.ai/` directory that solves the cold-start problem — agents no longer re-explore your project every session.

## Quick Start

```bash
npx ai-context init
```

That's it. Your project now has a `.ai/` directory with structured context files.

## What It Creates

```
.ai/
├── IDENTITY.md       # Project DNA: architecture, modules, tech stack
├── CONVENTIONS.md    # Coding patterns, style rules, build commands
├── DECISIONS.md      # Key architectural decisions (ADRs)
├── SPEC.md           # The .ai/ standard specification
├── memory/           # On-demand knowledge items (agents add these)
└── journal/          # Session summaries (written at session end)
```

**Layer 1** (IDENTITY + CONVENTIONS + DECISIONS) is designed to be **< 2000 tokens** — small enough to always load, rich enough to skip re-exploration.

## Commands

```bash
npx ai-context init        # Bootstrap .ai/ for the current project
npx ai-context status      # Show what .ai/ contains
npx ai-context update      # Re-detect and refresh IDENTITY.md

# Options
npx ai-context init --root /path/to/project   # Specify project root
npx ai-context init --force                    # Overwrite existing .ai/
```

## Supported Projects

| Language | Detects From | Frameworks |
|----------|-------------|------------|
| **TypeScript / JavaScript** | `package.json`, `tsconfig.json` | Next.js, React, Vue, Express, Fastify, NestJS, Hono |
| **Python** | `pyproject.toml`, `setup.py` | — |
| **Go** | `go.mod` | — |
| **Rust** | `Cargo.toml` | — |

Also detects: test frameworks (Jest, Vitest, pytest, etc.), build tools (esbuild, webpack, Vite), linters (ESLint, Prettier, Ruff), CI/CD, Docker, npm workspaces, and more.

## The Problem

Every AI coding session starts with amnesia. The agent doesn't know:

- Your project's architecture
- Your coding conventions
- Why you chose certain technologies
- What the known pitfalls are

This means **wasted tokens on re-exploration** and **inconsistent decisions** across sessions.

## The Solution

The `.ai/` directory standard gives agents a structured knowledge base:

1. **At session start**: Agent loads Layer 1 (~2K tokens of project DNA)
2. **During work**: Agent searches Layer 2 knowledge items when it encounters unfamiliar areas
3. **At session end**: Agent writes back what it learned to `memory/` and `journal/`

## Programmatic API

```typescript
import { detectProject, detectConventions, generateIdentity } from "ai-context";

const info = await detectProject("/path/to/project");
const conv = await detectConventions("/path/to/project", info);
const identity = generateIdentity(info);
```

## Compatibility

Works alongside all existing agent instruction files:

- `.github/copilot-instructions.md` (GitHub Copilot)
- `.cursorrules` (Cursor)
- `AGENTS.md` / `CLAUDE.md` (Claude Code)
- `GEMINI.md` (Gemini CLI)
- `.well-known/ai-native.json` (agent toolchain discovery)

The `.ai/` directory is complementary — it stores *project knowledge*, not *agent instructions*.

## Spec

This implements the `.ai/` directory standard. Full specification: [github.com/Harkirat155/ai-native](https://github.com/Harkirat155/ai-native)

## License

Apache-2.0
