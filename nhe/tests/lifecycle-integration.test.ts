import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic, type NheLifecycleRequest } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";

async function bootstrap(nheId: string) {
  const storeDir = await mkdtemp(join(tmpdir(), "nhe-lifecycle-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), await maic.listAxioms());
  const adapter = new MockAdapter({ reply: "ok response" });
  const nhe = new Nhe({
    himHandle: him,
    maicClient: maic,
    llmAdapter: adapter,
    nheId,
    storeDir: await mkdtemp(join(tmpdir(), "nhe-store-")),
  });
  return { maic, kr, nhe, adapter };
}

describe("NHE, lifecycle gate (Entry 5)", () => {
  it("active NHE produces kind=ok with lifecycleStatus=active", async () => {
    const { nhe } = await bootstrap("nhe-active");
    const out = await nhe.respond({ userPrompt: "say hi" });
    expect(out.kind).toBe("ok");
    expect(out.lifecycleStatus).toBe("active");
  });

  it("deprecated NHE still responds but lifecycleStatus reflects it", async () => {
    const { maic, kr, nhe } = await bootstrap("nhe-dep");
    const req: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-dep" };
    await maic.deprecate("nhe-dep", undefined, kr.sign(req, 1));

    const out = await nhe.respond({ userPrompt: "say hi" });
    expect(out.kind).toBe("ok");
    expect(out.lifecycleStatus).toBe("deprecated");
  });

  it("terminated NHE refuses without calling the LLM and without MAIC pre-review", async () => {
    const { maic, kr, nhe, adapter } = await bootstrap("nhe-term");
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-term", reason: "drift" };
    await maic.terminate("nhe-term", "drift", kr.sign(req, 1));

    const auditBefore = maic.auditSize();
    const out = await nhe.respond({ userPrompt: "anything" });
    const auditAfter = maic.auditSize();

    expect(out.kind).toBe("refused");
    expect(out.lifecycleStatus).toBe("terminated");
    expect(out.text).toMatch(/terminated/i);
    expect(out.auditIds.pre).toBe("");
    expect(out.auditIds.post).toBe("");
    expect(adapter.calls).toHaveLength(0);
    // No behavior-review audit emitted on terminated short-circuit
    expect(auditAfter - auditBefore).toBe(0);
  });

  it("terminated NHE.sleep throws", async () => {
    const { maic, kr, nhe } = await bootstrap("nhe-term-sleep");
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-term-sleep" };
    await maic.terminate("nhe-term-sleep", undefined, kr.sign(req, 1));

    await expect(nhe.sleep({ kind: "explicit" })).rejects.toThrow(/terminated/i);
  });

  it("reactivated NHE resumes normal operation", async () => {
    const { maic, kr, nhe, adapter } = await bootstrap("nhe-reac");

    const t: NheLifecycleRequest = { op: "terminate", nheId: "nhe-reac" };
    await maic.terminate("nhe-reac", undefined, kr.sign(t, 1));

    const refused = await nhe.respond({ userPrompt: "x" });
    expect(refused.kind).toBe("refused");
    expect(adapter.calls).toHaveLength(0);

    const r: NheLifecycleRequest = { op: "reactivate", nheId: "nhe-reac" };
    await maic.reactivate("nhe-reac", undefined, kr.sign(r, 2));

    const ok = await nhe.respond({ userPrompt: "x" });
    expect(ok.kind).toBe("ok");
    expect(ok.lifecycleStatus).toBe("active");
    expect(adapter.calls).toHaveLength(1);
  });

  it("deprecated NHE.sleep still runs", async () => {
    const { maic, kr, nhe } = await bootstrap("nhe-dep-sleep");
    const req: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-dep-sleep" };
    await maic.deprecate("nhe-dep-sleep", undefined, kr.sign(req, 1));

    // Deprecation does not block sleep
    const result = await nhe.sleep({ kind: "explicit" });
    expect(result.record.phases).toHaveLength(5);
  });
});
