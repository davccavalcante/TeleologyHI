import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    splitting: false,
    treeshake: true,
    external: ["@teleologyhi-sdk/maic", "@teleologyhi-sdk/him", "@anthropic-ai/sdk", "@modelcontextprotocol/sdk"],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "node20",
    splitting: false,
    treeshake: true,
    external: ["@teleologyhi-sdk/maic", "@teleologyhi-sdk/him", "@anthropic-ai/sdk", "@modelcontextprotocol/sdk"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
