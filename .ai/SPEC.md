---
version: "0.1"
status: draft
updated: 2026-02-24
---

# `.ai/` Directory Specification

An open standard for **agent-persistent project memory** — giving AI coding
agents instant context instead of starting cold every session.

## Problem

AI agents lose all project knowledge between sessions. Every new conversation
starts with expensive re-exploration of architecture, conventions, and past
decisions. This is the equivalent of a developer with amnesia.

## Solution

A `.ai/` directory in the project root containing structured, agent-optimized
files organized in three layers:

## Directory Structure

```
.ai/
├── IDENTITY.md          # L1: Project DNA (always loaded, <2K tokens)
├── CONVENTIONS.md       # L1: Coding patterns & rules
├── DECISIONS.md         # L1: Architectural decision records
├── SPEC.md              # This specification
├── memory/              # L2: On-demand knowledge items
│   ├── <topic>.md       # Individual knowledge articles
│   └── ...
└── journal/             # L2: Session summaries
    ├── <date>-<title>.md
    └── ...
```

## Layer 1: Always-Loaded Context

Files designed to be injected into every agent session automatically.
Total target: **< 2000 tokens combined**.

| File | Content | Format |
|------|---------|--------|
| `IDENTITY.md` | Project name, architecture, module map, tech stack, entry points | YAML frontmatter + structured markdown |
| `CONVENTIONS.md` | Coding style, patterns, testing, build commands, gotchas | YAML frontmatter + structured markdown |
| `DECISIONS.md` | Key architectural decisions with rationale | ADR-lite format |

### IDENTITY.md Required Fields

```yaml
---
project: <name>
version: <semver>
license: <SPDX>
repo: <url>
updated: <YYYY-MM-DD>
---
```

Must contain: Architecture summary, Module map table, Key dependencies,
Build/run commands.

### CONVENTIONS.md Required Fields

```yaml
---
updated: <YYYY-MM-DD>
scope: <all-modules | module-name>
---
```

Must contain: Language & style rules, Architecture patterns, Error handling
approach, Build commands, Known gotchas.

### DECISIONS.md Required Fields

```yaml
---
updated: <YYYY-MM-DD>
format: ADR-lite
---
```

Each decision: ID, title, decision statement, rationale, rejected alternatives.

## Layer 2: On-Demand Knowledge

### memory/ — Knowledge Items

Individual files on specific topics. Agents search these by filename/tags
when they encounter a relevant area.

```yaml
---
topic: <topic-name>
tags: [tag1, tag2, ...]
updated: <YYYY-MM-DD>
confidence: high | medium | low
related: [other-topic, ...]
---
```

### journal/ — Session Summaries

Written at the end of agent sessions to capture what was learned/changed.

```yaml
---
date: <YYYY-MM-DD>
agent: <agent-name>
session: <session-id>
summary: <one-line-summary>
---
```

## Design Principles

1. **Agent-native, not human-native** — optimize for token density and machine parsing
2. **File-based, not API-based** — any tool can read files; no lock-in
3. **Layered loading** — don't dump everything; load on demand
4. **Living documents** — agents contribute back, files evolve with the project
5. **Model-agnostic** — works with Claude, GPT, Gemini, Copilot, or any future model

## How Agents Should Use This

```
1. Check for .ai/ directory
2. Load Layer 1 files (IDENTITY.md, CONVENTIONS.md, DECISIONS.md)
3. Begin work with full project context
4. Search memory/ when encountering unfamiliar areas
5. At session end, write to journal/ and optionally update memory/
```

## Compatibility

This spec is designed to coexist with:

- `.github/copilot-instructions.md` (GitHub Copilot)
- `.cursorrules` (Cursor)
- `AGENTS.md` / `CLAUDE.md` (Claude Code)
- `.well-known/ai-native.json` (agent toolchain discovery)
- `vscode-bridge/SKILL.md` (agentskills.io)

The `.ai/` directory is complementary — it stores *project knowledge*, not
*agent instructions*. Instructions tell agents what to do; memory tells them
what they need to know.
