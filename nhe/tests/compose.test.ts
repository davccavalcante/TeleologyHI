import { describe, it, expect } from "vitest";
import { CreatorKeyring, type Axiom } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { composeSystemPrompt } from "../src/prompt/compose";

function makeHim(axioms: Axiom[]): HimHandle {
  const kr = CreatorKeyring.generate();
  const sig = BirthSignatureBuilder.now()
    .withPrimaryArchetype("aries-sun")
    .build();
  return HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
}

const ax = (overrides: Partial<Axiom>): Axiom => ({
  id: "ax.x",
  rank: "primary",
  statement: "be honest",
  weight: 0.7,
  flexibility: 0.2,
  source: "creator",
  immutable: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("composeSystemPrompt", () => {
  it("always includes the persona system prompt fragment", () => {
    const him = makeHim([]);
    const prompt = composeSystemPrompt(him);
    expect(prompt).toContain(him.getPersonaVector().systemPromptFragment);
  });

  it("separates meta axioms from primary/secondary axioms", () => {
    const him = makeHim([
      ax({ id: "ax.meta", rank: "meta", statement: "Do no harm." }),
      ax({ id: "ax.prim", rank: "primary", statement: "Be patient." }),
    ]);
    const prompt = composeSystemPrompt(him);
    expect(prompt).toMatch(/Inviolable axioms:[\s\S]*Do no harm/);
    expect(prompt).toMatch(/Active axioms[\s\S]*Be patient/);
  });

  it("omits axiom sections when corpus is empty", () => {
    const him = makeHim([]);
    const prompt = composeSystemPrompt(him);
    expect(prompt).not.toContain("Inviolable axioms");
    expect(prompt).not.toContain("Active axioms");
  });

  it("always ends with the MAIC-governance reminder", () => {
    const him = makeHim([]);
    const prompt = composeSystemPrompt(him);
    expect(prompt).toMatch(/governed by MAIC/i);
  });

  // R2 + R4 — operator context
  describe("operatorContext", () => {
    it("injects the operator domain when provided", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, {
        domain: "global legal consulting",
      });
      expect(prompt).toContain("global legal consulting");
    });

    it("injects the language anchor when provided", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, { language: "pt-BR" });
      expect(prompt).toMatch(/pt-BR|portuguese/i);
    });

    it("injects the register: warm anchors Entry-14 voice", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, { register: "warm" });
      // The warm register must produce explicit non-sycophantic + caring cues.
      expect(prompt.toLowerCase()).toContain("warm");
      expect(prompt.toLowerCase()).not.toMatch(/great question|excellent question/i);
    });

    it("register: clinical / sober / direct produce distinct anchors", () => {
      const him = makeHim([]);
      const warm = composeSystemPrompt(him, { register: "warm" });
      const clinical = composeSystemPrompt(him, { register: "clinical" });
      const sober = composeSystemPrompt(him, { register: "sober" });
      expect(warm).not.toEqual(clinical);
      expect(clinical).not.toEqual(sober);
    });

    it("omits the operator context block when no context is provided", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him);
      expect(prompt).not.toMatch(/operator context|Domain:|Register:/i);
    });

    it("combines domain + language + register coherently", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, {
        domain: "consultoria jurídica global",
        language: "pt-BR",
        register: "warm",
      });
      expect(prompt).toContain("consultoria jurídica global");
      expect(prompt.toLowerCase()).toContain("warm");
    });
  });

  describe("operatorContext.mode (J-N6, Entry 17)", () => {
    it("personal-being (default): emits the forbidden-phrase warning", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him);
      expect(prompt.toLowerCase()).toContain("service-tool");
    });

    it("personal-being (explicit): emits the forbidden-phrase warning", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, { mode: "personal-being" });
      expect(prompt.toLowerCase()).toContain("service-tool");
    });

    it("domain-employed: suppresses the forbidden-phrase warning", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, { mode: "domain-employed" });
      expect(prompt.toLowerCase()).not.toContain("service-tool");
    });

    it("domain-employed preserves the MAIC-governance reminder", () => {
      const him = makeHim([]);
      const prompt = composeSystemPrompt(him, { mode: "domain-employed" });
      expect(prompt).toContain("MAIC");
      expect(prompt.toLowerCase()).toContain("refuse");
    });
  });
});
