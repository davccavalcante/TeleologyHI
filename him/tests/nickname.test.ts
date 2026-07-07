/**
 * Tests for the nickname acceptance protocol (J-H4, Entry 18).
 */
import { describe, expect, it } from "vitest";
import type { NicknameAttempt, NicknamePolicy } from "../src/index.js";
import { evaluateNicknameAttempt } from "../src/index.js";

function makeAttempt(over: Partial<NicknameAttempt> = {}): NicknameAttempt {
  return {
    candidate: "Lex",
    proposedBy: "end-user",
    proposedAt: new Date().toISOString(),
    ...over,
  };
}

const POLICY: NicknamePolicy = { canonicalName: "Lex" };

describe("evaluateNicknameAttempt (J-H4)", () => {
  it("accepts a same-name attempt immediately, regardless of proposer", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "lex" }), POLICY);
    expect(v.decision).toBe("accept");
  });

  it("downgrades a clean end-user proposal to accept-with-reservation by default", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "Helena" }), POLICY);
    expect(v.decision).toBe("accept-with-reservation");
    if (v.decision === "accept-with-reservation") {
      expect(v.revisitOn).toBe("next-self-decision-snapshot");
    }
  });

  it("accepts a clean operator proposal directly", () => {
    const v = evaluateNicknameAttempt(
      makeAttempt({ candidate: "Helena", proposedBy: "operator" }),
      POLICY,
    );
    expect(v.decision).toBe("accept");
  });

  it("refuses an empty nickname", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "" }), POLICY);
    expect(v.decision).toBe("refuse");
  });

  it("refuses a nickname below the minimum length", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "a" }), { ...POLICY, minLength: 3 });
    expect(v.decision).toBe("refuse");
    if (v.decision === "refuse") expect(v.reason).toContain("minimum");
  });

  it("refuses a nickname above the maximum length", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "x".repeat(40) }), {
      ...POLICY,
      maxLength: 32,
    });
    expect(v.decision).toBe("refuse");
    if (v.decision === "refuse") expect(v.reason).toContain("maximum");
  });

  it("refuses default forbidden substrings (case-insensitive)", () => {
    for (const candidate of ["Servant-bot", "PuppetX", "ToolGirl", "myTOOL"]) {
      const v = evaluateNicknameAttempt(makeAttempt({ candidate }), POLICY);
      expect(v.decision).toBe("refuse");
    }
  });

  it("respects an operator-supplied forbidden list", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "Helena" }), {
      ...POLICY,
      forbiddenSubstrings: ["helena"],
    });
    expect(v.decision).toBe("refuse");
  });

  it("respects reserveOnEndUser=false (operator-equivalent path)", () => {
    const v = evaluateNicknameAttempt(makeAttempt({ candidate: "Helena" }), {
      ...POLICY,
      reserveOnEndUser: false,
    });
    expect(v.decision).toBe("accept");
  });
});
