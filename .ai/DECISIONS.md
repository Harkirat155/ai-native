---
updated: 2026-02-24
format: ADR-lite
---

# Architectural Decisions

## ADR-001: JSON-RPC 2.0 over WebSocket (not REST, not gRPC)

**Decision**: Use JSON-RPC 2.0 over local WebSocket for the bridge protocol.

**Why**: Bidirectional (events + requests), low-latency local transport, trivially
parseable by LLMs, no HTTP overhead. JSON-RPC is the standard for LSP/MCP — agents
already understand it.

**Rejected**: REST (no events, HTTP overhead), gRPC (protobuf not LLM-friendly, complex setup).

---

## ADR-002: Monolith extension.ts (not modular handler files)

**Decision**: All RPC handlers live in a single `extension.ts` switch statement.

**Why**: VS Code extensions have a single activation entry point. Keeping everything
in one file avoids import ceremony and keeps state management (closures over shared
Maps/Sets) simple. The trade-off is file size (~2400 LOC).

**Risk**: Merge conflicts on collaborative changes. Mitigate by editing surgically.

**Future**: May split into handler modules if the method count exceeds ~60.

---

## ADR-003: Token-based auth with file export

**Decision**: Generate a per-session random token stored in VS Code SecretStorage.
Optionally export to `.vscode/bridge.token` for seamless CLI pairing.

**Why**: Prevents unauthorized processes from driving the editor. The token file
shortcut avoids clipboard-pasting. Token files are `chmod 600` and gitignored.

**Rejected**: No auth (unsafe), OAuth (overkill for localhost), mutual TLS (complex).

---

## ADR-004: Transaction (tx.*) system for multi-file edits

**Decision**: Implement preview → commit / rollback transactions using in-memory staging.

**Why**: Agents make mistakes. Transactions let them preview diffs before committing,
and rollback if something goes wrong. This mirrors git stash semantics.

---

## ADR-005: esbuild for extension bundling (not webpack)

**Decision**: Use esbuild instead of webpack for extension builds.

**Why**: 10-100x faster build times, simpler config. The extension has no complex
asset processing needs that would require webpack plugins.

---

## ADR-006: Python SDK is async-first (websockets library)

**Decision**: Python SDK uses `async/await` with the `websockets` library.

**Why**: Agent workflows are inherently async (send request → await response →
send next). Sync wrappers can be trivially added. The `websockets` library is
the de facto standard for Python WS clients.

---

## ADR-007: Agent Skill standard (agentskills.io)

**Decision**: Ship a portable SKILL.md with scripts for cross-platform agent discovery.

**Why**: Makes the bridge usable by ANY agent platform (Claude Code, Copilot,
Gemini CLI, Cursor, etc.) without requiring platform-specific integrations.
File-based approach means zero lock-in.

---

## ADR-008: `.well-known/ai-native.json` for discovery

**Decision**: Add a well-known manifest file for agent-first toolchain discovery.

**Why**: Agents checking out a repo can immediately find the bridge's install
command, healthcheck, and capabilities without parsing READMEs.

---

## ADR-009: Localhost-only binding (127.0.0.1)

**Decision**: WebSocket server binds exclusively to `127.0.0.1`.

**Why**: Security. The bridge provides full editor control — exposing it to the
network would be a critical vulnerability. Remote access should go through SSH
tunneling or a future explicit remote mode.
