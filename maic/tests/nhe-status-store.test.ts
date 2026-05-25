import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NheStatusStore } from "../src/nhes/status-store";
import { CreatorKeyring } from "../src/creator/keyring";
import type { NheLifecycleRequest } from "../src/types";

describe("NheStatusStore", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let store: NheStatusStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-status-"));
    kr = CreatorKeyring.generate();
    store = await NheStatusStore.open(dir, kr.publicKey());
  });

  it("returns null for an NHE without an explicit status record", async () => {
    expect(await store.get("nhe-unknown")).toBeNull();
  });

  it("resolves status to 'active' for an unknown NHE", async () => {
    expect(await store.resolve("nhe-unknown")).toBe("active");
  });

  it("terminate sets status to terminated with a timestamp", async () => {
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-1", reason: "drift" };
    const rec = await store.apply(req, kr.sign(req, 1));
    expect(rec.status).toBe("terminated");
    expect(rec.reason).toBe("drift");
    expect(rec.since).toMatch(/^\d{4}-/);
    expect(await store.resolve("nhe-1")).toBe("terminated");
  });

  it("deprecate sets status to deprecated", async () => {
    const req: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-2" };
    await store.apply(req, kr.sign(req, 1));
    expect(await store.resolve("nhe-2")).toBe("deprecated");
  });

  it("reactivate brings deprecated back to active", async () => {
    const dep: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-3" };
    await store.apply(dep, kr.sign(dep, 1));
    const reac: NheLifecycleRequest = { op: "reactivate", nheId: "nhe-3" };
    await store.apply(reac, kr.sign(reac, 2));
    expect(await store.resolve("nhe-3")).toBe("active");
  });

  it("reactivate revives a terminated NHE (Creator-signed only)", async () => {
    const term: NheLifecycleRequest = { op: "terminate", nheId: "nhe-4" };
    await store.apply(term, kr.sign(term, 1));
    const reac: NheLifecycleRequest = { op: "reactivate", nheId: "nhe-4" };
    const rec = await store.apply(reac, kr.sign(reac, 2));
    expect(rec.status).toBe("active");
  });

  it("rejects deprecate of an already-terminated NHE (must reactivate first)", async () => {
    const term: NheLifecycleRequest = { op: "terminate", nheId: "nhe-5" };
    await store.apply(term, kr.sign(term, 1));
    const dep: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-5" };
    await expect(store.apply(dep, kr.sign(dep, 2))).rejects.toThrow(/terminated/i);
  });

  it("rejects invalid Creator signature", async () => {
    const impostor = CreatorKeyring.generate();
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-x" };
    await expect(store.apply(req, impostor.sign(req, 1))).rejects.toThrow(/signature/i);
  });

  it("idempotent: applying the same status twice returns the existing record", async () => {
    const req: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-idem" };
    const first = await store.apply(req, kr.sign(req, 1));
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.apply(req, kr.sign(req, 2));
    expect(second.since).toBe(first.since); // unchanged
  });

  it("list filters by status", async () => {
    const t: NheLifecycleRequest = { op: "terminate", nheId: "a" };
    const d: NheLifecycleRequest = { op: "deprecate", nheId: "b" };
    await store.apply(t, kr.sign(t, 1));
    await store.apply(d, kr.sign(d, 2));
    const terminated = await store.list({ status: "terminated" });
    expect(terminated.map((r) => r.nheId)).toEqual(["a"]);
  });

  it("persists records across reopen", async () => {
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-persist", reason: "drift" };
    await store.apply(req, kr.sign(req, 1));
    const reopened = await NheStatusStore.open(dir, kr.publicKey());
    expect(await reopened.resolve("nhe-persist")).toBe("terminated");
    const rec = await reopened.get("nhe-persist");
    expect(rec?.reason).toBe("drift");
    await rm(dir, { recursive: true, force: true });
  });
});
