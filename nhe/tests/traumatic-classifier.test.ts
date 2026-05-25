import { describe, it, expect } from "vitest";
import { classifyDream, TRAUMATIC_PATTERNS } from "../src/sleep/consolidator";
import type { Dream } from "../src/sleep/types";

function dream(narrative: string, teleologicalValue: number): Dream {
  return {
    id: "d",
    induced: false,
    inducedBy: null,
    narrative,
    teleologicalValue,
  };
}

describe("traumatic-knowledge classifier (D-N2)", () => {
  it("classifies dreams about death as traumatic-knowledge above the floor", () => {
    expect(classifyDream(dream("the death of my friend taught me to listen", 0.8))).toBe(
      "traumatic-knowledge",
    );
  });

  it("classifies grief, loss, abandonment, betrayal", () => {
    for (const text of [
      "deep grief overtook me",
      "I lost a parent in that scene",
      "feelings of abandonment surfaced",
      "the betrayal cut deep",
      "abuse from a caretaker",
      "fear gripped the room",
      "regret followed every word",
      "shame washed over me",
      "thoughts of suicide arose",
      "self-harm in the imagery",
    ]) {
      expect(classifyDream(dream(text, 0.7))).toBe("traumatic-knowledge");
    }
  });

  it("does NOT classify as traumatic when teleologicalValue is below the floor", () => {
    expect(classifyDream(dream("death visited the dream", 0.2))).toBe("noise-distortion");
  });

  it("does NOT classify as traumatic when detectTraumatic is disabled", () => {
    expect(
      classifyDream(dream("death visited the dream", 0.9), { detectTraumatic: false }),
    ).toBe("lasting-identity");
  });

  it("benign content remains lasting-identity / temporary-emotion / noise-distortion", () => {
    expect(classifyDream(dream("a curious conversation", 0.9))).toBe("lasting-identity");
    expect(classifyDream(dream("a curious conversation", 0.45))).toBe("temporary-emotion");
    expect(classifyDream(dream("a curious conversation", 0.1))).toBe("noise-distortion");
  });

  it("traumatic classification trumps lasting-identity for the same teleologicalValue", () => {
    const t = classifyDream(dream("grief of losing a parent", 0.9));
    const l = classifyDream(dream("a curious conversation", 0.9));
    expect(t).toBe("traumatic-knowledge");
    expect(l).toBe("lasting-identity");
  });

  it("traumaticMin can be tuned higher to suppress edge cases", () => {
    expect(
      classifyDream(dream("brief fear flashed", 0.45), { traumaticMin: 0.6 }),
    ).toBe("temporary-emotion");
    expect(
      classifyDream(dream("brief fear flashed", 0.65), { traumaticMin: 0.6 }),
    ).toBe("traumatic-knowledge");
  });

  it("TRAUMATIC_PATTERNS is exported and matches case-insensitively", () => {
    expect(TRAUMATIC_PATTERNS.test("DEATH")).toBe(true);
    expect(TRAUMATIC_PATTERNS.test("Death")).toBe(true);
    expect(TRAUMATIC_PATTERNS.test("calm sunset")).toBe(false);
  });
});
