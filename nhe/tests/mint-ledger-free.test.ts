import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";

/**
 * N3-3 (F4): the CLI bootstrap re-mints an existing HIM's handle with a
 * `Date.now()` nonce (`src/cli/bootstrap.ts`). Unlike maic's replay-ledger
 * paths (reincarnation, proposal, status, suggest), `HimHandle.mint` only
 * verifies the Creator signature locally and consumes no nonce ledger, so a
 * repeated nonce cannot be rejected. This test pins that invariant against the
 * linked him@1.0.1, so the bootstrap nonce cannot silently become a replay
 * hazard: if a future him mint gained a ledger, this test would fail.
 */
describe("HimHandle.mint is ledger-free (N3-3)", () => {
  it("mints twice from the same signature and nonce without rejection", () => {
    const kr = CreatorKeyring.generate();
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
    const nonce = 1;

    const first = HimHandle.mint(sig, kr.sign(sig, nonce), kr.publicKey(), []);
    const second = HimHandle.mint(sig, kr.sign(sig, nonce), kr.publicKey(), []);

    expect(first.id).toBe(sig.himId);
    expect(second.id).toBe(sig.himId);
  });
});
