/**
 * Single source of truth for the runtime package version (ND-4).
 *
 * Kept in sync with `package.json` "version" at release time. The runtime
 * constants that surface a version (the `Nhe.version` default, the MCP server
 * version, and the OpenTelemetry meter/tracer versions) all import this so a
 * promotion changes one literal, not five scattered ones.
 */
export const NHE_VERSION = "1.0.1";
