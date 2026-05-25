import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { ulid } from "ulid";

const ROUNDS_DIR = resolve(process.cwd(), ".arena-store/rounds");

export interface Round {
  prompt: string;
  left: { model: string; response: string; durationMs: number };
  right: {
    model: string;
    response: string;
    durationMs: number;
    /** `RespondKind`: `"ok" | "redirect" | "refused"`. */
    kind?: string;
    /** Post-review verdict kind: `"approve" | "warn" | "deny"`. */
    verdict?: string;
    /** Pre-review verdict kind (exposed when it diverges from `verdict`). */
    preVerdict?: string;
    /** True when the NHE refused to participate. */
    refused?: boolean;
    /** Axiom IDs cited by HIM at either pre or post review. */
    citedAxioms?: string[];
  };
}

export async function saveRound(r: Round): Promise<string> {
  await mkdir(ROUNDS_DIR, { recursive: true });
  const id = ulid();
  const at = new Date().toISOString();
  const path = resolve(ROUNDS_DIR, `${id}.yaml`);
  const payload = stringify(
    { id, at, ...r },
    { lineWidth: 120, sortMapEntries: false },
  );
  await writeFile(path, payload, "utf8");
  return id;
}
