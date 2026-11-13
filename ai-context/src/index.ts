/**
 * index.ts — Public API for programmatic usage.
 *
 * ```ts
 * import { init, status } from "ai-context";
 * await init({ root: "/path/to/project" });
 * ```
 */

export { detectProject, detectConventions } from "./detector.js";
export type { ProjectInfo, ConventionInfo, ModuleInfo, DepInfo } from "./detector.js";

export {
    generateIdentity,
    generateConventions,
    generateDecisions,
    generateSpec,
} from "./generator.js";
