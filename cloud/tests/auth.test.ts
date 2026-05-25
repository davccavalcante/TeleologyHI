import { describe, it, expect } from "vitest";
import type { IncomingMessage } from "node:http";
import {
  authorize,
  constantTimeTokenMatch,
  isAuthDisabled,
  isProductionEnv,
} from "../src/auth";

function makeReq(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe("constantTimeTokenMatch", () => {
  it("returns true on exact match", () => {
    const set = new Set(["abc", "xyz"]);
    expect(constantTimeTokenMatch("abc", set)).toBe(true);
    expect(constantTimeTokenMatch("xyz", set)).toBe(true);
  });

  it("returns false on wrong-length candidate", () => {
    const set = new Set(["abc"]);
    expect(constantTimeTokenMatch("ab", set)).toBe(false);
    expect(constantTimeTokenMatch("abcd", set)).toBe(false);
  });

  it("returns false on right-length but wrong-bytes candidate", () => {
    const set = new Set(["abc"]);
    expect(constantTimeTokenMatch("abd", set)).toBe(false);
    expect(constantTimeTokenMatch("xyz", set)).toBe(false);
  });

  it("returns false on empty set", () => {
    expect(constantTimeTokenMatch("anything", new Set())).toBe(false);
  });

  it("matches the LAST accepted token (no short-circuit observable timing)", () => {
    // The loop runs over every accepted token regardless of where the match
    // sits — verify behaviour with the match at the end of the set.
    const set = new Set(["aaa", "bbb", "ccc", "ddd", "eee"]);
    expect(constantTimeTokenMatch("eee", set)).toBe(true);
  });
});

describe("authorize", () => {
  const tokens = new Set(["secret-token-1", "secret-token-2"]);

  it("returns true for a valid Bearer token", () => {
    expect(
      authorize(
        makeReq({ authorization: "Bearer secret-token-1" }),
        tokens,
        false,
      ),
    ).toBe(true);
  });

  it("returns false when no header is present", () => {
    expect(authorize(makeReq({}), tokens, false)).toBe(false);
  });

  it("returns false on non-Bearer scheme", () => {
    expect(
      authorize(
        makeReq({ authorization: "Basic secret-token-1" }),
        tokens,
        false,
      ),
    ).toBe(false);
  });

  it("returns false on empty token", () => {
    expect(
      authorize(makeReq({ authorization: "Bearer " }), tokens, false),
    ).toBe(false);
  });

  it("returns false on wrong token", () => {
    expect(
      authorize(makeReq({ authorization: "Bearer nope" }), tokens, false),
    ).toBe(false);
  });

  it("returns true when auth is explicitly disabled (empty set + opt-in)", () => {
    expect(
      authorize(makeReq({}), new Set(), true),
    ).toBe(true);
  });

  it("returns false when set is empty WITHOUT explicit opt-in (closed by default)", () => {
    expect(
      authorize(makeReq({ authorization: "Bearer anything" }), new Set(), false),
    ).toBe(false);
    expect(
      authorize(makeReq({}), new Set(), undefined),
    ).toBe(false);
  });
});

describe("isAuthDisabled", () => {
  it("only true when set is empty AND opt-in is true", () => {
    expect(isAuthDisabled(new Set(), true)).toBe(true);
    expect(isAuthDisabled(new Set(), false)).toBe(false);
    expect(isAuthDisabled(new Set(), undefined)).toBe(false);
    expect(isAuthDisabled(new Set(["x"]), true)).toBe(false);
    expect(isAuthDisabled(new Set(["x"]), false)).toBe(false);
  });
});

describe("isProductionEnv", () => {
  it("true on TELEOLOGYHI_ENV=production", () => {
    expect(isProductionEnv({ TELEOLOGYHI_ENV: "production" })).toBe(true);
  });

  it("true on NODE_ENV=production", () => {
    expect(isProductionEnv({ NODE_ENV: "production" })).toBe(true);
  });

  it("false on staging / dev / test / unset", () => {
    expect(isProductionEnv({})).toBe(false);
    expect(isProductionEnv({ NODE_ENV: "staging" })).toBe(false);
    expect(isProductionEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionEnv({ NODE_ENV: "test" })).toBe(false);
  });
});
