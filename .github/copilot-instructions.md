# Copilot Instructions

Project goal: VS Code Bridge extension + external client exposing VS Code capabilities via JSON-RPC.

## Implementation rules
- Prefer VS Code APIs over re-implementing tooling.
- Make minimal diffs; avoid churn and speculative refactors.
- All RPC methods must return structured results and stable error codes.
- Apply changes via `WorkspaceEdit` where possible; surface partial failures explicitly.

