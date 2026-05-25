import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    splitting: false,
    treeshake: true,
    external: ["@teleologyhi-sdk/maic", "@teleologyhi-sdk/him"],
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "node20",
    splitting: false,
    treeshake: true,
    external: ["@teleologyhi-sdk/maic", "@teleologyhi-sdk/him"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
