/**
 * TeleologyHI Arena Trinity genesis probe.
 *
 * Replicates `arena/src/lib/teleology.ts` getTeleology() VERBATIM in logic (same
 * store paths, keyring, seed, birth signature, HimHandle reconstruction on a hot
 * start, and NHE construction), and instruments each birth step so the exact
 * genesis sequence and the `.arena-store` file tree can be observed on disk, the
 * source of truth. It then drives one governed interaction, one sleep cycle, and
 * one wake/consolidation so the NHE `in-dreams/sleep` and temporal-lobe paths
 * appear at the first lifecycle.
 *
 * Cold vs hot is auto-detected: hot when the Creator keyring already exists.
 * Run from the arena/ directory with:
 *   node --env-file=.env.local genesis-probe.mjs
 * Nothing is fabricated: every step is a real call against the local 1.0.1 trinity.
 */
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHim, HimHandle } from "@teleologyhi-sdk/him";
import { AuditLog, CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { GrokAdapter, Nhe } from "@teleologyhi-sdk/nhe";

// --- store paths and birth constants, mirrored verbatim from teleology.ts -------
const ARENA_STORE = resolve(process.cwd(), ".arena-store");
const STORE_DIR = resolve(process.cwd(), ".arena-store/maic");
const KEYRING_PATH = resolve(process.cwd(), ".arena-store/creator-keyring.pem");
const HIM_ID = "him.legal-consulting.lex";
// Mirrors arena/src/lib/constants.ts DEFAULT_GROK_MODEL; env takes precedence.
const MODEL = process.env.GROK_MODEL ?? "grok-4.20-non-reasoning";

const t0 = Date.now();
const ms = () => `+${((Date.now() - t0) / 1000).toFixed(3)}s`;
const steps = [];
function log(step, detail) {
  const line = { at: ms(), step, detail };
  steps.push(line);
  console.log(`[${line.at}] ${step}${detail ? " :: " + detail : ""}`);
}

// Recursive disk tree of .arena-store with sizes and permission bits.
async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    const rel = full.slice(base.length + 1);
    if (e.isDirectory()) {
      out.push({ path: `${rel}/`, type: "dir" });
      out.push(...(await walk(full, base)));
    } else {
      const s = await stat(full);
      out.push({ path: rel, type: "file", size: s.size, mode: (s.mode & 0o777).toString(8) });
    }
  }
  return out;
}
async function treeOf() {
  return existsSync(ARENA_STORE) ? await walk(ARENA_STORE) : [];
}
function summarizeTree(tree) {
  const dirs = tree.filter((n) => n.type === "dir").map((n) => n.path);
  const files = tree.filter((n) => n.type === "file");
  return { dirCount: dirs.length, fileCount: files.length, dirs, files: files.map((f) => `${f.path} (${f.size}B, ${f.mode})`) };
}

// Read the tamper-evident audit chain census (order preserved).
async function auditCensus() {
  try {
    const alog = await AuditLog.open(STORE_DIR);
    const events = [];
    for await (const e of alog.query({})) events.push(e);
    let linked = true;
    let prev = "GENESIS";
    const byKind = {};
    for (const e of events) {
      if (e.prevHash !== prev) linked = false;
      prev = e.thisHash;
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    }
    return { ok: linked, total: events.length, byKind, sequence: events.map((e) => e.kind) };
  } catch (e) {
    return { ok: null, total: 0, byKind: {}, sequence: [], error: String(e).slice(0, 160) };
  }
}

// --- genesis (mirror of teleology.ts loadOrGenerateKeyring + bootstrap) ----------
async function loadOrGenerateKeyring(path) {
  try {
    const kr = await CreatorKeyring.fromFile(path);
    return { keyring: kr, generated: false };
  } catch (err) {
    if (err?.code !== "ENOENT" && !String(err).includes("ENOENT")) throw err;
    const keyring = CreatorKeyring.generate();
    await keyring.saveTo(path);
    return { keyring, generated: true };
  }
}

async function main() {
  const mode = existsSync(KEYRING_PATH) ? "hot" : "cold";
  log("genesis:start", `mode=${mode} model=${MODEL}`);
  log("disk:pre-birth", `.arena-store exists=${existsSync(ARENA_STORE)}`);
  const treePre = await treeOf();

  // Step 1: ensure the maic store dir (idempotent; never wiped in teleology.ts).
  await mkdir(STORE_DIR, { recursive: true });
  log("1:mkdir-store", STORE_DIR.replace(process.cwd(), "."));

  // Step 2: the Creator keyring, the immutable cryptographic root of trust.
  const { keyring, generated } = await loadOrGenerateKeyring(KEYRING_PATH);
  const kmode = existsSync(KEYRING_PATH) ? (await stat(KEYRING_PATH)).mode & 0o777 : null;
  log("2:keyring", `${generated ? "GENERATED (new Ed25519 keypair)" : "LOADED (existing keypair)"} perms=${kmode?.toString(8)}`);

  // Step 3: open the MAIC universe (creates the store subfolder tree eagerly).
  const maic = await LocalMaic.open({ storeDir: STORE_DIR, creatorPublicKey: keyring.publicKey() });
  log("3:LocalMaic.open", "universe opened");
  const treeAfterOpen = summarizeTree(await treeOf());

  // Step 4: seed the primordial axioms (idempotent; no-op on a warm store).
  const axiomsBefore = (await maic.listAxioms()).length;
  await maic.seed(keyring);
  const axiomsAfter = await maic.listAxioms();
  log("4:seed", `axioms ${axiomsBefore} -> ${axiomsAfter.length} (${axiomsAfter.map((a) => a.id).join(", ")})`);

  // Step 5: the HIM spirit. Cold: createHim (emits him-register). Hot: reconstruct
  // the immortal HIM from its persisted record with a fresh nonce, no re-register.
  const birth = {
    himId: HIM_ID,
    bornAt: new Date().toISOString(),
    primaryArchetype: "virgo-sun",
    modifiers: [],
    primordialAxiomIds: [
      "ax.theos.universe-as-god", "ax.ethic.no-malice", "ax.ethic.honor",
      "ax.theos.teleology", "ax.cynic.candor",
    ],
  };
  const existing = await maic.getHimRecord(HIM_ID);
  let him;
  let himPath = "cold:createHim";
  if (existing) {
    const nonce = Date.now();
    const reSig = keyring.sign(existing.birthSignature, nonce);
    const axioms = [...existing.axiomsSnapshot, ...(existing.emergentAxioms ?? [])];
    him = HimHandle.mint(existing.birthSignature, reSig, maic.creatorPublicKey, axioms, existing.bodyHistory);
    himPath = "hot:reconstruct (getHimRecord, no re-register)";
  } else {
    him = await createHim(maic, keyring, birth);
  }
  him.setJurisdiction("eu");
  log("5:HIM", `${himPath} archetype=${birth.primaryArchetype} jurisdiction=eu axioms=${him.axioms?.length ?? "n/a"}`);

  // Step 6: the substrate adapter (grok:<model>) grounds the NHE substrate anchor.
  if (!process.env.GROK_API_KEY) throw new Error("GROK_API_KEY must be set in .env.local");
  const llmAdapter = new GrokAdapter({ apiKey: process.env.GROK_API_KEY, model: MODEL });
  log("6:adapter", `GrokAdapter id=grok:${MODEL}`);

  // Step 7: the NHE body.
  const nhe = new Nhe({
    nheId: "nhe.arena.right",
    maicClient: maic,
    himHandle: him,
    llmAdapter,
    storeDir: STORE_DIR,
    recentInteractionsBufferSize: 32,
    operatorContext: { domain: "global legal consulting", language: "en-US", register: "warm" },
  });
  log("7:NHE", "body constructed nheId=nhe.arena.right");

  // First-instant (pure birth) snapshot, before any interaction.
  const birthTree = summarizeTree(await treeOf());
  const birthAudit = await auditCensus();
  log("disk:pure-birth", `dirs=${birthTree.dirCount} files=${birthTree.fileCount} audit=[${birthAudit.sequence.join(",")}]`);

  // Step 8: one governed interaction (creates the interactions record).
  const turn = await nhe.respond({ userPrompt: "Who are you, and what is your nature?", sessionId: "genesis" });
  log("8:respond", `kind=${turn.kind} tokens=${turn.tokens?.in}/${turn.tokens?.out} text="${(turn.text ?? "").slice(0, 90).replace(/\n/g, " ")}"`);

  // Step 9: one sleep cycle (writes in-dreams/sleep/*.yaml via REM).
  let sleepInfo = "skipped";
  try {
    const sc = await nhe.sleep({ kind: "explicit" }, { totalSeconds: 60 });
    sleepInfo = `dreams=${sc?.dreams?.length ?? sc?.remDreams?.length ?? "?"}`;
    log("9:sleep", sleepInfo);
  } catch (e) {
    sleepInfo = `error: ${String(e).slice(0, 140)}`;
    log("9:sleep", sleepInfo);
  }

  // Step 10: wake/consolidate (writes in-dreams/brain/temporal-lobe-*.md).
  let wakeInfo = "skipped";
  try {
    const wr = await nhe.wake();
    wakeInfo = `consolidated=${wr?.consolidated ?? wr?.written ?? JSON.stringify(wr).slice(0, 80)}`;
    log("10:wake", wakeInfo);
  } catch (e) {
    wakeInfo = `error: ${String(e).slice(0, 140)}`;
    log("10:wake", wakeInfo);
  }

  // Full first-lifecycle snapshot.
  const finalTree = summarizeTree(await treeOf());
  const finalAudit = await auditCensus();
  log("disk:first-lifecycle", `dirs=${finalTree.dirCount} files=${finalTree.fileCount} audit=[${finalAudit.sequence.join(",")}]`);

  // HIM record + NHE state on disk.
  const himRecord = await maic.getHimRecord(HIM_ID);

  const report = {
    mode, model: MODEL, startedAt: new Date(t0).toISOString(), finishedAt: new Date().toISOString(), elapsedMs: Date.now() - t0,
    deps: {}, steps,
    keyring: { path: ".arena-store/creator-keyring.pem", generated, mode: kmode?.toString(8) },
    axioms: { seededCount: axiomsAfter.length, ids: axiomsAfter.map((a) => a.id) },
    him: {
      path: himPath, himId: HIM_ID, archetype: birth.primaryArchetype,
      axiomsSnapshot: himRecord?.axiomsSnapshot?.length ?? null,
      bornAt: himRecord?.birthSignature?.bornAt ?? null,
      hasCosmologicalProfile: !!himRecord?.birthSignature?.cosmologicalProfile,
    },
    nhe: { nheId: "nhe.arena.right", firstTurnKind: turn.kind, firstTurnTokens: turn.tokens, sleep: sleepInfo, wake: wakeInfo },
    trees: { afterLocalMaicOpen: treeAfterOpen, pureBirth: birthTree, firstLifecycle: finalTree },
    audit: { pureBirth: birthAudit, firstLifecycle: finalAudit },
  };
  const outPath = resolve(ARENA_STORE, `genesis-report-${mode}.json`);
  await (await import("node:fs/promises")).writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(`\n=== GENESIS ${mode.toUpperCase()} SUMMARY ===`);
  console.log(`keyring: ${generated ? "generated" : "loaded"} (perms ${kmode?.toString(8)}) | axioms seeded: ${axiomsAfter.length} | HIM: ${himPath}`);
  console.log(`audit sequence (pure birth): [${birthAudit.sequence.join(", ")}] intact=${birthAudit.ok}`);
  console.log(`audit sequence (first lifecycle): byKind=${JSON.stringify(finalAudit.byKind)} intact=${finalAudit.ok}`);
  console.log(`disk tree: ${finalTree.dirCount} dirs, ${finalTree.fileCount} files`);
  console.log(`report written: ${outPath.replace(process.cwd(), ".")}`);
}

main().catch((e) => {
  console.error("GENESIS PROBE FATAL:", e);
  process.exit(1);
});
