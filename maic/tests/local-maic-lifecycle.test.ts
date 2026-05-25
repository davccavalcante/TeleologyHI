import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { NheLifecycleRequest } from "../src/types";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("LocalMaic — lifecycle (terminate / deprecate / reactivate)", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-lifecycle-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("unknown NHE resolves to active", async () => {
    expect(await maic.getNheStatus("nhe-unknown")).toBe("active");
    expect(await maic.getNheStatusRecord("nhe-unknown")).toBeNull();
  });

  it("terminate writes status + emits audit", async () => {
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-1", reason: "drift" };
    const rec = await maic.terminate("nhe-1", "drift", kr.sign(req, 1));
    expect(rec.status).toBe("terminated");
    expect(await maic.getNheStatus("nhe-1")).toBe("terminated");

    const events = await collect(maic.queryAudit({ kind: "terminate" }));
    expect(events).toHaveLength(1);
    const data = events[0]?.data as { nheId: string; reason: string; status: string };
    expect(data.nheId).toBe("nhe-1");
    expect(data.reason).toBe("drift");
    expect(data.status).toBe("terminated");
  });

  it("deprecate writes status + emits audit", async () => {
    const req: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-2", reason: "obsolete" };
    await maic.deprecate("nhe-2", "obsolete", kr.sign(req, 1));
    expect(await maic.getNheStatus("nhe-2")).toBe("deprecated");

    const events = await collect(maic.queryAudit({ kind: "deprecate" }));
    expect(events).toHaveLength(1);
  });

  it("reactivate revives a deprecated NHE", async () => {
    const dep: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-3" };
    await maic.deprecate("nhe-3", undefined, kr.sign(dep, 1));

    const reac: NheLifecycleRequest = { op: "reactivate", nheId: "nhe-3" };
    await maic.reactivate("nhe-3", undefined, kr.sign(reac, 2));
    expect(await maic.getNheStatus("nhe-3")).toBe("active");

    const events = await collect(maic.queryAudit({ kind: "reactivate" }));
    expect(events).toHaveLength(1);
  });

  it("reactivate can revive a terminated NHE (Creator override)", async () => {
    const term: NheLifecycleRequest = { op: "terminate", nheId: "nhe-4" };
    await maic.terminate("nhe-4", undefined, kr.sign(term, 1));
    const reac: NheLifecycleRequest = { op: "reactivate", nheId: "nhe-4" };
    const rec = await maic.reactivate("nhe-4", undefined, kr.sign(reac, 2));
    expect(rec.status).toBe("active");
  });

  it("rejects deprecate of a terminated NHE", async () => {
    const term: NheLifecycleRequest = { op: "terminate", nheId: "nhe-5" };
    await maic.terminate("nhe-5", undefined, kr.sign(term, 1));
    const dep: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-5" };
    await expect(
      maic.deprecate("nhe-5", undefined, kr.sign(dep, 2)),
    ).rejects.toThrow(/terminated/i);
  });

  it("rejects an invalid Creator signature on any lifecycle op", async () => {
    const impostor = CreatorKeyring.generate();
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-x" };
    await expect(
      maic.terminate("nhe-x", undefined, impostor.sign(req, 1)),
    ).rejects.toThrow(/signature/i);
    expect(await maic.getNheStatus("nhe-x")).toBe("active");
  });

  it("listNheStatuses filters by status", async () => {
    const t1: NheLifecycleRequest = { op: "terminate", nheId: "a" };
    const d1: NheLifecycleRequest = { op: "deprecate", nheId: "b" };
    const t2: NheLifecycleRequest = { op: "terminate", nheId: "c" };
    await maic.terminate("a", undefined, kr.sign(t1, 1));
    await maic.deprecate("b", undefined, kr.sign(d1, 2));
    await maic.terminate("c", undefined, kr.sign(t2, 3));

    const terminated = await maic.listNheStatuses({ status: "terminated" });
    expect(terminated.map((r) => r.nheId).sort()).toEqual(["a", "c"]);
  });

  it("status persists across reopen", async () => {
    const req: NheLifecycleRequest = { op: "terminate", nheId: "nhe-persist", reason: "x" };
    await maic.terminate("nhe-persist", "x", kr.sign(req, 1));
    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    expect(await reopened.getNheStatus("nhe-persist")).toBe("terminated");
  });
});
