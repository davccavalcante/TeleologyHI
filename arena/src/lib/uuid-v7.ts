/**
 * UUID v7 generator (RFC 9562, May 2024).
 *
 * Layout (128 bits, big-endian):
 *
 *   bits 0..47    unix_ts_ms       Unix timestamp in milliseconds
 *   bits 48..51   ver              Version (always 0b0111 = 7)
 *   bits 52..63   rand_a           12 random bits
 *   bits 64..65   var              Variant (always 0b10, RFC 4122)
 *   bits 66..127  rand_b           62 random bits
 *
 * Why UUID v7 (and not v4 or ULID):
 *
 *   - Time-ordered (sortable): same property as ULID, unlike v4.
 *   - IETF standard (RFC 9562): future-proof, universal.
 *   - 36-character hex+dash format: drop-in replacement for v4 in any
 *     system that already understands UUID.
 *
 * Why we implement it ourselves (no `uuid` npm dep):
 *
 *   - The spec is small (~30 lines of code).
 *   - Adding a dep for a single function is overkill.
 *   - `node:crypto.randomBytes` is the canonical CSPRNG on Node ≥ 18.
 *
 * Reserved exclusively for `conversationUuid` per the architectural decision
 * documented in `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 27 (forthcoming). All
 * other ids in the project (`userId`, `nheId`, `himId`, `turnId`, `auditId`,
 * `proposalId`, `ticketId`) remain ULID for backwards compatibility with the
 * three published packages `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity`.
 */
import { randomBytes } from "node:crypto";

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Generate a new UUID v7. Output is lowercase, with hyphens, e.g.
 * `01890c1c-9f7e-7234-89ab-cdef01234567`.
 */
export function uuidv7(): string {
  const timestamp = Date.now();
  const rand = randomBytes(10);
  const buf = Buffer.alloc(16);

  // Bytes 0..5: 48-bit big-endian unix_ts_ms.
  // JavaScript numbers are safe up to 2**53, so 48-bit ms fits cleanly.
  buf[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
  buf[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
  buf[2] = Math.floor(timestamp / 2 ** 24) & 0xff;
  buf[3] = Math.floor(timestamp / 2 ** 16) & 0xff;
  buf[4] = Math.floor(timestamp / 2 ** 8) & 0xff;
  buf[5] = timestamp & 0xff;

  // Byte 6: high nibble = version 7 (0x7_), low nibble = top 4 bits of rand_a.
  buf[6] = (rand[0] & 0x0f) | 0x70;
  // Byte 7: bottom 8 bits of rand_a.
  buf[7] = rand[1];
  // Byte 8: high 2 bits = variant 0b10, low 6 bits = top 6 bits of rand_b.
  buf[8] = (rand[2] & 0x3f) | 0x80;
  // Bytes 9..15: bottom 56 bits of rand_b.
  buf[9] = rand[3];
  buf[10] = rand[4];
  buf[11] = rand[5];
  buf[12] = rand[6];
  buf[13] = rand[7];
  buf[14] = rand[8];
  buf[15] = rand[9];

  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Validate that a string looks like a UUID v7. Returns `true` for the exact
 * canonical lowercase 36-char hex+dash form with version `7` and variant
 * `[89ab]`. Does NOT accept uppercase or compact forms.
 */
export function isUuidV7(s: string): boolean {
  return typeof s === "string" && UUID_V7_REGEX.test(s);
}

/**
 * Extract the embedded `unix_ts_ms` timestamp from a UUID v7. Useful for
 * sorting + displaying conversation timestamps without a separate `createdAt`
 * field. Throws if the input is not a valid UUID v7.
 */
export function uuidv7Timestamp(uuid: string): number {
  if (!isUuidV7(uuid)) {
    throw new Error(`uuidv7Timestamp: not a valid UUID v7: ${uuid}`);
  }
  const hex = uuid.replace(/-/g, "").slice(0, 12);
  return Number.parseInt(hex, 16);
}
