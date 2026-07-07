import { BirthSignatureWithIdentity, IdentityLayer, NatalChart } from "@teleologyhi-sdk/maic";
import { ulid } from "ulid";
import type { z } from "zod";
import { type ArchetypeModifier, BirthSignature } from "../types.js";

/**
 * BirthSignatureBuilder, fluent builder for `BirthSignature` and the
 * extended `BirthSignatureWithIdentity` shape (Entries 18 + 19).
 *
 * Per Entry 3 of the Creator's interview, a HIM is "born" with a date, time, and
 * foundational specifications analogous to an astrological natal chart. The
 * builder extends this with two opt-in cosmology surfaces:
 *
 *   - `withNatalChart(chart)`, the Creator-impressed astrological signature
 *     (Entry 19), one of the six fields covered by the Ed25519 BirthSignature
 *     signature (see `SIGNED_BIRTH_FIELDS`).
 *   - `withIdentity(identity)`, the editable identity surface (Entry 18,
 *     name + optional gender, pronouns, language, cultural elements). Not
 *     covered by the Ed25519 signature; parents may rename without breaking
 *     the natal-chart commitment.
 *
 * Two terminal methods:
 *
 *   - `build()`, returns the legacy `BirthSignature` (ignores natalChart + identity).
 *   - `buildWithIdentity()`, returns the extended `BirthSignatureWithIdentity`
 *     suitable for `signBirthSignature(birth, keyring)` from `@teleologyhi-sdk/maic`.
 */
export class BirthSignatureBuilder {
  private himId: string = ulid();
  private bornAt: string;
  private primaryArchetype: string | undefined;
  private modifiers: ArchetypeModifier[] = [];
  private primordialAxiomIds: string[] = [];
  private notes: string | undefined;
  private natalChart: z.infer<typeof NatalChart> | undefined;
  private identity: z.infer<typeof IdentityLayer> | undefined;

  private constructor(bornAt: string) {
    this.bornAt = bornAt;
  }

  /** Start a builder with the current timestamp as `bornAt`. */
  static now(): BirthSignatureBuilder {
    return new BirthSignatureBuilder(new Date().toISOString());
  }

  /** Start a builder with an explicit ISO 8601 timestamp (with offset). */
  static at(iso: string): BirthSignatureBuilder {
    if (Number.isNaN(Date.parse(iso))) {
      throw new Error(`BirthSignatureBuilder.at: invalid ISO 8601 timestamp "${iso}"`);
    }
    return new BirthSignatureBuilder(iso);
  }

  withHimId(id: string): this {
    if (!id) throw new Error("BirthSignatureBuilder.withHimId: empty id");
    this.himId = id;
    return this;
  }

  withPrimaryArchetype(archetype: string): this {
    if (!archetype) {
      throw new Error("BirthSignatureBuilder.withPrimaryArchetype: empty value");
    }
    this.primaryArchetype = archetype;
    return this;
  }

  withModifier(mod: ArchetypeModifier): this {
    this.modifiers.push(mod);
    return this;
  }

  withPrimordialAxioms(axiomIds: string[]): this {
    this.primordialAxiomIds = [...axiomIds];
    return this;
  }

  withNotes(notes: string): this {
    this.notes = notes;
    return this;
  }

  /**
   * Set the natal-chart astrological signature (Entry 19). Validated against
   * the `NatalChart` zod schema re-exported from `@teleologyhi-sdk/maic`.
   */
  withNatalChart(chart: z.input<typeof NatalChart>): this {
    this.natalChart = NatalChart.parse(chart);
    return this;
  }

  /**
   * Set the editable identity layer (Entry 18). Validated against the
   * `IdentityLayer` zod schema re-exported from `@teleologyhi-sdk/maic`.
   */
  withIdentity(identity: z.input<typeof IdentityLayer>): this {
    this.identity = IdentityLayer.parse(identity);
    return this;
  }

  build(): BirthSignature {
    if (!this.primaryArchetype) {
      throw new Error("BirthSignatureBuilder.build: primaryArchetype is required");
    }
    return BirthSignature.parse({
      himId: this.himId,
      bornAt: this.bornAt,
      primaryArchetype: this.primaryArchetype,
      modifiers: this.modifiers,
      primordialAxiomIds: this.primordialAxiomIds,
      ...(this.notes !== undefined ? { notes: this.notes } : {}),
    });
  }

  /**
   * Build the extended shape including the optional cosmology surface.
   * Suitable for `signBirthSignature(birth, keyring)` from
   * `@teleologyhi-sdk/maic`. Only the six `SIGNED_BIRTH_FIELDS` are covered
   * by the Ed25519 signature; the `identity` surface is editable.
   *
   * The result is validated through the `BirthSignatureWithIdentity` zod schema
   * (F-6): since maic 1.0.1 that schema persists identity / natalChart /
   * cosmologicalProfile instead of stripping them, so an invalid modifier list
   * or malformed field is caught here at build time rather than surfacing later
   * at `registerHim`.
   */
  buildWithIdentity(): BirthSignatureWithIdentity {
    if (!this.primaryArchetype) {
      throw new Error("BirthSignatureBuilder.buildWithIdentity: primaryArchetype is required");
    }
    return BirthSignatureWithIdentity.parse({
      himId: this.himId,
      bornAt: this.bornAt,
      primaryArchetype: this.primaryArchetype,
      modifiers: this.modifiers,
      primordialAxiomIds: this.primordialAxiomIds,
      ...(this.notes !== undefined ? { notes: this.notes } : {}),
      ...(this.identity !== undefined ? { identity: this.identity } : {}),
      ...(this.natalChart !== undefined ? { natalChart: this.natalChart } : {}),
    });
  }
}
