/**
 * Canonical JSON serialization for deterministic signing.
 *
 * Rules (RFC 8785-inspired subset, sufficient for our payloads):
 *   - Object keys sorted lexicographically (Unicode code points).
 *   - No insignificant whitespace.
 *   - Strings use JSON's default escaping.
 *   - Numbers: integers are emitted plain; floats use JS default (we don't accept NaN/Infinity).
 *   - Arrays preserve order.
 *   - undefined values are dropped (same as JSON.stringify).
 */
export function canonicalJSON(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("canonicalJSON: non-finite number not allowed");
    }
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map(serialize).join(",")}]`;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`);
    return `{${parts.join(",")}}`;
  }
  throw new Error(`canonicalJSON: unsupported type ${typeof v}`);
}
