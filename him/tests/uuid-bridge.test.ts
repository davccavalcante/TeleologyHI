/**
 * Tests for the UUIDv7 migration bridge (J-H5 — Entry 18).
 */
import { describe, expect, it } from "vitest";
import {
  isLegacyHimId,
  isUuidV7,
  migrateLegacyHimId,
  mintUuidV7,
} from "../src/index.js";

describe("isLegacyHimId (J-H5)", () => {
  it("recognises the legacy slug shape", () => {
    expect(isLegacyHimId("him.legal-consulting.lex")).toBe(true);
    expect(isLegacyHimId("him.creative-writing.muse")).toBe(true);
    expect(isLegacyHimId("him.domain.sub-domain.entity")).toBe(true);
  });

  it("rejects non-slug values", () => {
    expect(isLegacyHimId("Lex")).toBe(false);
    expect(isLegacyHimId("him.lex")).toBe(false); // need two segments
    expect(isLegacyHimId("him.")).toBe(false);
    expect(isLegacyHimId("")).toBe(false);
    expect(isLegacyHimId("018f7a1d-3a4b-7c2d-8e1f-2a3b4c5d6e7f")).toBe(false);
  });
});

describe("mintUuidV7 + isUuidV7 (J-H5)", () => {
  it("produces a syntactically valid UUIDv7", () => {
    const id = mintUuidV7();
    expect(isUuidV7(id)).toBe(true);
  });

  it("produces a distinct id on each call", () => {
    const a = mintUuidV7();
    const b = mintUuidV7();
    expect(a).not.toBe(b);
  });

  it("encodes the supplied timestamp in the high 48 bits", () => {
    const now = Date.now();
    const id = mintUuidV7(now);
    // Extract the first 12 hex chars (48 bits) and check they encode `now`.
    const ts = Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16);
    expect(ts).toBe(now);
  });

  it("isUuidV7 rejects malformed strings", () => {
    expect(isUuidV7("not-a-uuid")).toBe(false);
    expect(isUuidV7("018f7a1d-3a4b-4c2d-8e1f-2a3b4c5d6e7f")).toBe(false); // UUIDv4 — should be rejected by the UUIDv7 validator
    expect(isUuidV7("")).toBe(false);
  });
});

describe("migrateLegacyHimId (J-H5)", () => {
  it("returns a UUIDv7 + the original slug as alias", () => {
    const legacy = "him.legal-consulting.lex";
    const m = migrateLegacyHimId(legacy);
    expect(isUuidV7(m.uuid)).toBe(true);
    expect(m.legacyAlias).toBe(legacy);
    expect(typeof m.migratedAt).toBe("string");
    // ISO 8601
    expect(Number.isNaN(Date.parse(m.migratedAt))).toBe(false);
  });

  it("throws on non-legacy inputs (UUIDv7, empty, random string)", () => {
    expect(() => migrateLegacyHimId(mintUuidV7())).toThrow();
    expect(() => migrateLegacyHimId("")).toThrow();
    expect(() => migrateLegacyHimId("Lex")).toThrow();
  });
});
