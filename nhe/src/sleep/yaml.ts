import { parse, stringify } from "yaml";
import { DreamRecord } from "./types.js";

/** Serialize a DreamRecord to YAML. Validates input via zod first. */
export function dreamRecordToYaml(record: DreamRecord): string {
  return stringify(DreamRecord.parse(record));
}

/** Parse and validate YAML into a DreamRecord. Throws on schema mismatch. */
export function dreamRecordFromYaml(text: string): DreamRecord {
  return DreamRecord.parse(parse(text));
}

/**
 * Filename convention for sleep YAML: `<YYYY-MM-DD>_<HHmm>_dur<minutes>.yaml`.
 * Times are interpreted in UTC.
 */
export function sleepYamlFilename(startedAt: string, durationMinutes: number): string {
  const d = new Date(startedAt);
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const dur = Math.round(durationMinutes);
  return `${yyyy}-${MM}-${DD}_${HH}${mm}_dur${dur}.yaml`;
}
