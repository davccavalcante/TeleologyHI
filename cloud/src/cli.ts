// Shebang `#!/usr/bin/env node` is injected by tsup's `banner.js` at build
// time (see tsup.config.ts). Keeping it out of the source avoids duplicate
// shebangs when esbuild parses the file.
import { startCloudFromEnv } from "./server.js";

async function main() {
  const handle = await startCloudFromEnv();
  process.stdout.write(`@teleologyhi-sdk/cloud listening on ${handle.url}\n`);

  const shutdown = (signal: string) => () => {
    process.stdout.write(`\nreceived ${signal}, shutting down\n`);
    handle.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown("SIGINT"));
  process.on("SIGTERM", shutdown("SIGTERM"));
}

main().catch((err) => {
  process.stderr.write(`cloud: ${(err as Error).message}\n`);
  process.exit(1);
});
