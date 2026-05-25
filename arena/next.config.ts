import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep the canonical TeleologyHI packages out of the client bundle.
   * They are server-only (`crypto`, `node:fs`, ed25519 signature surface)
   * and bundling them into a React Server Component edge transform causes
   * confusing tree-shake errors.
   */
  serverExternalPackages: [
    "@teleologyhi-sdk/maic",
    "@teleologyhi-sdk/him",
    "@teleologyhi-sdk/nhe",
  ],
};

export default nextConfig;
