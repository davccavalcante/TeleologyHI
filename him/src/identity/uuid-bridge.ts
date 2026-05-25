/**
 * UUID migration bridge helpers (J-H5 — Entry 18 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * HIM has historically identified HIMs with human-readable slugs such as
 * `him.legal-consulting.lex`. Entry 18 commits to migrating `himId` to
 * UUIDv7 so the canonical id is content-free; the human-readable name
 * moves into `BirthSignatureWithIdentity.identity.name` where parents
 * may rename without affecting the natal-chart commitment.
 *
 * This module ships **only opt-in bridge helpers**. The `himId` field
 * stays typed as `string` for backward compatibility. A future cut
 * will land the strict-UUID enforcement after Creator design review
 * (see PROPOSED_DECISIONS.md follow-up for the bridge-alias retention
 * horizon).
 *
 * UUIDv7 is RFC 9562 compliant: a 48-bit Unix-millisecond timestamp
 * prefix followed by 74 random bits + the version (4 bits) and variant
 * (2 bits) markers. The implementation here uses Node's
 * `crypto.randomBytes(16)` (the full 16-byte UUID buffer), overwrites
 * bytes 0..5 with the big-endian timestamp, then writes the version
 * (`0x70` in the high nibble of byte 6) and variant (`0x80` in the high
 * two bits of byte 8) markers inline. No external dependency.
 */
import { randomBytes } from "node:crypto";

/** Strict slug pattern recognised as a legacy himId. */
const LEGACY_HIM_ID_REGEX = /^him\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Strict UUIDv7 pattern. */
const UUIDV7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Return `true` when the id matches the legacy slug shape. */
export function isLegacyHimId(id: string): boolean {
  return LEGACY_HIM_ID_REGEX.test(id);
}

/** Return `true` when the id is a valid UUIDv7. */
export function isUuidV7(id: string): boolean {
  return UUIDV7_REGEX.test(id);
}

/**
 * Mint a fresh UUIDv7. Pure helper, no I/O beyond the crypto RNG.
 *
 * Layout (RFC 9562):
 *   - bits 0..47   : Unix ms timestamp (big-endian)
 *   - bits 48..51  : version = 0b0111 (7)
 *   - bits 52..63  : random
 *   - bits 64..65  : variant = 0b10
 *   - bits 66..127 : random
 */
export function mintUuidV7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  // 48-bit timestamp (ms).
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  // Version 7 in the high nibble of byte 6.
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Variant 0b10 in the high two bits of byte 8.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Result of migrating a legacy slug to a UUIDv7-anchored identity. */
export interface MigratedHimId {
  /** The new canonical UUIDv7 id. */
  uuid: string;
  /** The legacy slug, preserved as a bridge alias for backward lookups. */
  legacyAlias: string;
  /** When the migration was performed. ISO 8601. */
  migratedAt: string;
}

/**
 * Migrate a legacy `him.foo.bar`-style id to a UUIDv7-anchored identity.
 *
 * Throws when the input is not a recognised legacy slug — callers that
 * just want a fresh uuid should call `mintUuidV7()` directly.
 *
 * The returned `legacyAlias` MUST be preserved by the operator's HIM
 * store so existing references (audit-log entries, third-party
 * integrations, archived prompts) continue to resolve. The retention
 * horizon for the alias is a Creator decision deferred to a future cut.
 */
export function migrateLegacyHimId(
  legacy: string,
  now: number = Date.now(),
): MigratedHimId {
  if (!isLegacyHimId(legacy)) {
    throw new Error(
      `migrateLegacyHimId: "${legacy}" is not a recognised legacy himId slug`,
    );
  }
  return {
    uuid: mintUuidV7(now),
    legacyAlias: legacy,
    migratedAt: new Date(now).toISOString(),
  };
}
