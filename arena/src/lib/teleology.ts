/**
 * Singleton MAIC + HIM + NHE wiring for the "right column" of the arena.
 * Initialised once at server startup (lazy on first request) so each turn
 * goes through the same Creator-signed governance, lawful character, and
 * audit log.
 *
 * Target persona: a global legal-consulting firm. The HIM is bound to the
 * `eu` LawfulCharacterProfile so it cites the right framework when the
 * conversation touches GDPR / EU AI Act / DSA.
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHim, HimHandle } from "@teleologyhi-sdk/him";
import { type BirthSignature, CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { GrokAdapter, Nhe } from "@teleologyhi-sdk/nhe";
import { DEFAULT_GROK_MODEL } from "./constants";

// Gemini path kept dormant for a future Gemini/Grok toggle:
// import { DEFAULT_GEMINI_MODEL } from "./constants";
// import { GeminiRotatingAdapter } from "./gemini-rotating-adapter";

// `.arena-store/maic/` holds the persistent MAIC universe — axioms, hims, the
// hash-chained audit log, and accumulated interactions. Per
// `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 26, this store is now the persistent
// universe and is NEVER wiped at bootstrap: MAIC™ as the panentheist Universe
// expands across newly-born HIMs, accumulated interactions, ratified
// emergent axioms, and ecosystem relational density. The Creator keyring is
// persisted alongside the store (PEM file, 0600 permissions) so the
// cryptographic root of trust survives across process restarts and the HIMs
// it signed remain verifiable. Per-user conversations live alongside under
// `.arena-store/users/{userId}/conversations/{conversationUuid}.json` — the
// E27-F conversation-as-base-unit layout that supersedes the legacy
// `.arena-store/rounds/` YAML notebook.
//
// Both the keyring file and the entire `.arena-store/` tree are gitignored.
const STORE_DIR = resolve(process.cwd(), ".arena-store/maic");
const KEYRING_PATH = resolve(process.cwd(), ".arena-store/creator-keyring.pem");
const HIM_ID = "him.legal-consulting.lex";

interface Bundle {
  keyring: CreatorKeyring;
  maic: LocalMaic;
  him: HimHandle;
  nhe: Nhe;
}

let cached: Promise<Bundle> | undefined;

/**
 * Lazily bootstrap (or return the cached) MAIC+HIM+NHE bundle. The cached
 * promise is **cleared on failure** so a transient error (e.g. missing
 * `GEMINI_API_KEY` at first request that the operator subsequently sets) no
 * longer poisons every later request — the next call re-attempts bootstrap.
 */
export function getTeleology(): Promise<Bundle> {
  if (!cached) {
    cached = bootstrap().catch((err: unknown) => {
      cached = undefined;
      throw err;
    });
  }
  return cached;
}

/**
 * Load the Creator keyring from disk, or generate it on first boot and
 * persist it. Subsequent boots reuse the same Ed25519 keypair so MAIC™'s
 * cryptographic identity is stable across process restarts (Entry 26: the
 * keyring is one of the three immutable regions of MAIC™).
 */
async function loadOrGenerateKeyring(path: string): Promise<CreatorKeyring> {
  try {
    return await CreatorKeyring.fromFile(path);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") throw err;
    const keyring = CreatorKeyring.generate();
    await keyring.saveTo(path);
    return keyring;
  }
}

async function bootstrap(): Promise<Bundle> {
  // The store is the persistent universe. We ensure the directory exists
  // (idempotent) but never wipe it — see the file-level comment above.
  await mkdir(STORE_DIR, { recursive: true });

  const keyring = await loadOrGenerateKeyring(KEYRING_PATH);
  const maic = await LocalMaic.open({
    storeDir: STORE_DIR,
    creatorPublicKey: keyring.publicKey(),
  });

  // Seed the primordial axioms into the MAIC universe. `seed()` is Creator-signed
  // and idempotent (it uses a reserved nonce range), so it is a no-op on a warm
  // store and establishes the constitution on a cold first boot. This MUST run
  // before the HIM is born: the Universe needs its axioms before a spirit can
  // snapshot them. Without it, a fresh deployment registers the HIM with an empty
  // axiom snapshot, its composed prompt loses the inviolable/active axiom
  // sections, and its verdicts cite axioms that are not actually in the store
  // (Arena finding F-COLD-1, round 4 cold-start).
  await maic.seed(keyring);

  const birth: BirthSignature = {
    himId: HIM_ID,
    bornAt: new Date().toISOString(),
    primaryArchetype: "virgo-sun",
    modifiers: [],
    primordialAxiomIds: [
      "ax.theos.universe-as-god",
      "ax.ethic.no-malice",
      "ax.ethic.honor",
      "ax.theos.teleology",
      "ax.cynic.candor",
    ],
  };

  // HIM is immortal (Entry 26 §6). On first boot we register the HIM via
  // `createHim` (which emits the canonical `him-register` audit event). On
  // subsequent boots the HIM record is already on disk: we reconstruct the
  // HimHandle directly from the persisted record with a freshly-signed nonce,
  // skipping the registration step entirely so the audit chain does not
  // accumulate duplicate `him-register` events for the same immortal spirit.
  // The keyring is the same across boots (Entry 26 §3 invariant), so
  // signature verification holds.
  const existing = await maic.getHimRecord(HIM_ID);
  let him: HimHandle;
  if (existing) {
    const nonce = Date.now();
    const reSig = keyring.sign(existing.birthSignature, nonce);
    const axioms = [...existing.axiomsSnapshot, ...(existing.emergentAxioms ?? [])];
    him = HimHandle.mint(
      existing.birthSignature,
      reSig,
      maic.creatorPublicKey,
      axioms,
      existing.bodyHistory,
    );
  } else {
    him = await createHim(maic, keyring, birth);
  }
  him.setJurisdiction("eu");

  // --- Gemini path (kept commented for a future Gemini/Grok toggle) ---
  // if (!process.env.GEMINI_API_KEY) {
  //   throw new Error("GEMINI_API_KEY must be set in .env.local");
  // }
  // The GeminiRotatingAdapter consumes the comma-separated GEMINI_API_KEY pool
  // via `gemini-key-pool`, rotating transparently on 401/403/429 or network
  // failures; end users see only the slightly-higher durationMs of the turn.
  // const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  // const llmAdapter = new GeminiRotatingAdapter({ model });
  //
  // --- Active: Grok (single GROK_API_KEY, no key pool) ---
  // The governed column runs the same underlying model as the raw column, so the
  // only difference the arena measures is governance, not the LLM. The adapter id
  // (grok:<model>) grounds the NHE substrate anchor, so the entity discloses Grok
  // as its real substrate and any claim of another provider is redirected.
  if (!process.env.GROK_API_KEY) {
    throw new Error("GROK_API_KEY must be set in .env.local");
  }
  const model = process.env.GROK_MODEL ?? DEFAULT_GROK_MODEL;
  const llmAdapter = new GrokAdapter({ apiKey: process.env.GROK_API_KEY, model });

  const nhe = new Nhe({
    nheId: "nhe.arena.right",
    maicClient: maic,
    himHandle: him,
    llmAdapter,
    storeDir: STORE_DIR,
    recentInteractionsBufferSize: 32,
    operatorContext: {
      domain: "global legal consulting",
      language: "en-US",
      register: "warm",
    },
  });

  return { keyring, maic, him, nhe };
}
