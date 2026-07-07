/**
 * Smoke tests for `buildMcpServer` (TASK.md J3), the MCP server wiring that
 * exposes NHE + MAIC capabilities as MCP tools (Claude Desktop, Cursor,
 * any MCP-aware client). We do NOT start a transport here, that would
 * require a live stdio/tcp peer; instead we exercise the wiring function
 * and inspect the registered tool catalogue via the `McpServer` instance.
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { bootstrap } from "../src/cli/bootstrap";
import { buildMcpServer } from "../src/cli/mcp";

const EXPECTED_TOOLS = [
  "nhe_respond",
  "nhe_recall",
  "nhe_sleep",
  "nhe_wake",
  "maic_list_axioms",
  "maic_list_hims",
] as const;

async function freshBootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "nhe-cli-mcp-"));
  return bootstrap({
    storeDir: dir,
    llmAdapter: new MockAdapter({ reply: "[mock reply]" }),
  });
}

describe("buildMcpServer, wiring smoke", () => {
  it("constructs an McpServer instance without throwing", async () => {
    const { nhe, maic } = await freshBootstrap();
    const server = buildMcpServer(nhe, maic);
    expect(server).toBeDefined();
    expect(typeof (server as unknown as { connect: unknown }).connect).toBe("function");
  });

  it("registers the six expected NHE + MAIC tools", async () => {
    const { nhe, maic } = await freshBootstrap();
    const server = buildMcpServer(nhe, maic);
    const registered = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    ).sort();
    expect(registered).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("each registered tool carries a non-empty title + description", async () => {
    const { nhe, maic } = await freshBootstrap();
    const server = buildMcpServer(nhe, maic);
    const tools = (
      server as unknown as {
        _registeredTools: Record<string, { title?: string; description?: string }>;
      }
    )._registeredTools;
    for (const name of EXPECTED_TOOLS) {
      const tool = tools[name];
      expect(tool, `tool ${name} should be registered`).toBeDefined();
      expect(tool.title, `tool ${name} should have a non-empty title`).toBeTruthy();
      expect(tool.description, `tool ${name} should have a non-empty description`).toBeTruthy();
    }
  });
});
