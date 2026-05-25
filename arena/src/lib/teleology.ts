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
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CreatorKeyring,
  LocalMaic,
  type BirthSignature,
} from "@teleologyhi-sdk/maic";
import { createHim, type HimHandle } from "@teleologyhi-sdk/him";
import { GeminiAdapter, Nhe } from "@teleologyhi-sdk/nhe";
import { DEFAULT_GEMINI_MODEL } from "./constants";

// `.arena-store/maic/` holds MAIC state (axioms, hims, audit chain, interactions).
// It is wiped on every process bootstrap because the CreatorKeyring is
// generated ephemerally; persisting a HIM signed by a previous-process keyring
// makes the next process unable to remint it. `.arena-store/rounds/` lives
// alongside but is preserved (those are the saved YAML rounds — the lab log).
const STORE_DIR = resolve(process.cwd(), ".arena-store/maic");
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

async function bootstrap(): Promise<Bundle> {
  await rm(STORE_DIR, { recursive: true, force: true });
  await mkdir(STORE_DIR, { recursive: true });

  const keyring = CreatorKeyring.generate();
  const maic = await LocalMaic.open({
    storeDir: STORE_DIR,
    creatorPublicKey: keyring.publicKey(),
  });

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

  const him = await createHim(maic, keyring, birth);
  him.setJurisdiction("eu");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY must be set in .env.local");
  }
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const llmAdapter = new GeminiAdapter({ apiKey, model });

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
