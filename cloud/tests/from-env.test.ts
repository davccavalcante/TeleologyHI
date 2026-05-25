import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring } from "@teleologyhi-sdk/maic";
import { startCloudFromEnv } from "../src/index";

const ENV_KEYS = [
  "TELEOLOGYHI_STORE_DIR",
  "TELEOLOGYHI_CREATOR_PUBLIC_KEY",
  "TELEOLOGYHI_TOKENS",
  "TELEOLOGYHI_ALLOW_UNAUTHENTICATED",
  "TELEOLOGYHI_ENV",
  "NODE_ENV",
  "PORT",
  "HOST",
] as const;

const ENV_BACKUP: Record<string, string | undefined> = {};

describe("startCloudFromEnv", () => {
  let dir: string;
  let publicKey: string;

  beforeEach(async () => {
    for (const k of ENV_KEYS) ENV_BACKUP[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
    dir = await mkdtemp(join(tmpdir(), "cloud-fromenv-"));
    publicKey = CreatorKeyring.generate().publicKey();
  });

  afterEach(async () => {
    for (const k of ENV_KEYS) {
      const v = ENV_BACKUP[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("throws when TELEOLOGYHI_STORE_DIR is missing", async () => {
    await expect(startCloudFromEnv()).rejects.toThrow(
      /TELEOLOGYHI_STORE_DIR must be set/,
    );
  });

  it("throws when TELEOLOGYHI_CREATOR_PUBLIC_KEY is missing", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    await expect(startCloudFromEnv()).rejects.toThrow(
      /TELEOLOGYHI_CREATOR_PUBLIC_KEY must be set/,
    );
  });

  it("throws when TELEOLOGYHI_TOKENS is empty without explicit unauthenticated opt-in", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"] = publicKey;
    await expect(startCloudFromEnv()).rejects.toThrow(
      /TELEOLOGYHI_TOKENS must be set/,
    );
  });

  it("refuses unauthenticated mode in production (TELEOLOGYHI_ENV=production)", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"] = publicKey;
    process.env["TELEOLOGYHI_ALLOW_UNAUTHENTICATED"] = "true";
    process.env["TELEOLOGYHI_ENV"] = "production";
    await expect(startCloudFromEnv()).rejects.toThrow(
      /Refusing to start without authentication/,
    );
  });

  it("refuses unauthenticated mode in production (NODE_ENV=production)", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"] = publicKey;
    process.env["TELEOLOGYHI_ALLOW_UNAUTHENTICATED"] = "true";
    process.env["NODE_ENV"] = "production";
    await expect(startCloudFromEnv()).rejects.toThrow(
      /Refusing to start without authentication/,
    );
  });

  it("starts with valid TOKENS in production", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"] = publicKey;
    process.env["TELEOLOGYHI_TOKENS"] = "tk-1,tk-2";
    process.env["NODE_ENV"] = "production";
    process.env["PORT"] = "0";
    process.env["HOST"] = "127.0.0.1";
    const handle = await startCloudFromEnv();
    try {
      const addr = handle.server.address();
      expect(addr).toBeTruthy();
    } finally {
      await handle.close();
    }
  });

  it("starts with empty TOKENS + explicit allowUnauthenticated outside production (smoke path)", async () => {
    process.env["TELEOLOGYHI_STORE_DIR"] = dir;
    process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"] = publicKey;
    process.env["TELEOLOGYHI_ALLOW_UNAUTHENTICATED"] = "true";
    process.env["PORT"] = "0";
    process.env["HOST"] = "127.0.0.1";
    const handle = await startCloudFromEnv();
    try {
      const addr = handle.server.address();
      expect(addr).toBeTruthy();
    } finally {
      await handle.close();
    }
  });
});
