import { describe, it, expect, beforeAll } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring } from "../src/creator/keyring";

describe("CreatorKeyring.generate", () => {
  it("produces a usable key pair", () => {
    const kr = CreatorKeyring.generate();
    expect(kr.publicKey()).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(kr.publicKey().length).toBeGreaterThan(20);
  });
});

describe("CreatorKeyring sign/verify round-trip", () => {
  const kr = CreatorKeyring.generate();

  it("verifies its own signature on a simple payload", () => {
    const sig = kr.sign({ statement: "love thy neighbor" }, 1);
    expect(CreatorKeyring.verify({ statement: "love thy neighbor" }, sig)).toBe(true);
  });

  it("verifies regardless of object key order (canonical JSON)", () => {
    const sig = kr.sign({ a: 1, b: 2, c: 3 }, 42);
    expect(CreatorKeyring.verify({ c: 3, a: 1, b: 2 }, sig)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const sig = kr.sign({ statement: "love thy neighbor" }, 1);
    expect(CreatorKeyring.verify({ statement: "love thy enemy" }, sig)).toBe(false);
  });

  it("rejects a tampered signature value", () => {
    const sig = kr.sign({ statement: "x" }, 1);
    const tampered = { ...sig, value: "A".repeat(sig.value.length) };
    expect(CreatorKeyring.verify({ statement: "x" }, tampered)).toBe(false);
  });

  it("verifyWith pins the expected public key (different key fails)", () => {
    const other = CreatorKeyring.generate();
    const sig = other.sign({ statement: "x" }, 1);
    // primitive verify is self-validating (always true for a well-formed signature)
    expect(CreatorKeyring.verify({ statement: "x" }, sig)).toBe(true);
    // verifyWith pins: passing the wrong expected public key rejects
    expect(CreatorKeyring.verifyWith(kr.publicKey(), { statement: "x" }, sig)).toBe(false);
    // passing the originating public key accepts
    expect(CreatorKeyring.verifyWith(other.publicKey(), { statement: "x" }, sig)).toBe(true);
  });

  it("includes the nonce in the signed payload (nonce mismatch fails)", () => {
    const sig = kr.sign({ statement: "x" }, 7);
    const sigWrongNonce = { ...sig, nonce: 8 };
    expect(CreatorKeyring.verify({ statement: "x" }, sigWrongNonce)).toBe(false);
  });
});

describe("CreatorKeyring file round-trip", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-keyring-"));
  });

  it("saves and loads from PEM file", async () => {
    const kr = CreatorKeyring.generate();
    const path = join(dir, "creator.pem");
    await kr.saveTo(path);
    const loaded = await CreatorKeyring.fromFile(path);
    expect(loaded.publicKey()).toBe(kr.publicKey());

    const sig = loaded.sign({ statement: "x" }, 1);
    expect(CreatorKeyring.verify({ statement: "x" }, sig)).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });
});
