import { rename, writeFile } from "node:fs/promises";

/**
 * Write a record file atomically: write the content to a sibling temp file,
 * then rename it over the target. rename(2) is atomic on POSIX, so a crash
 * mid-write can never leave a truncated or half-written record at the target
 * path; the store either keeps the previous version or gets the complete new
 * one (M2-4, 1.0.1). Used by every record-file persist path in the five
 * stores. Append-only ledgers (the audit NDJSON chain and the nonce logs) use
 * appendFile instead, which is already crash-safe for their format.
 */
export async function atomicWriteFile(path: string, data: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data, "utf-8");
  await rename(tmp, path);
}
