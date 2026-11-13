import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/cli.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "dist/cli.js",
    banner: { js: "#!/usr/bin/env node" },
    external: [],
});

// Also build a library entry point
await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "dist/index.js",
    external: [],
});

console.log("✅ Built dist/cli.js + dist/index.js");
