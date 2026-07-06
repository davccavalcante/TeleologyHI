import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { LocalMaic } from "@teleologyhi-sdk/maic";
import { z } from "zod";
import type { Nhe } from "../nhe.js";
import { NHE_VERSION } from "../version.js";
import {
  maicListAxiomsHandler,
  maicListHimsHandler,
  nheRecallHandler,
  nheRespondHandler,
  nheSleepHandler,
  nheWakeHandler,
} from "./mcp-tools.js";

const PKG_VERSION = NHE_VERSION;

/** Build a configured McpServer wired to a bootstrapped NHE + MAIC. */
export function buildMcpServer(nhe: Nhe, maic: LocalMaic): McpServer {
  const server = new McpServer({
    name: "@teleologyhi-sdk/nhe",
    version: PKG_VERSION,
  });

  server.registerTool(
    "nhe_respond",
    {
      title: "Send a prompt to the NHE",
      description:
        "Run a user prompt through the NHE's MAIC pre-review → LLM → MAIC post-review pipeline. " +
        "Returns text plus the verdict kind and any redirect metadata.",
      inputSchema: {
        userPrompt: z.string().min(1),
        redirectAttempt: z.number().int().nonnegative().optional(),
        jurisdiction: z.string().optional(),
      },
    },
    async (args) => nheRespondHandler(nhe, args),
  );

  server.registerTool(
    "nhe_recall",
    {
      title: "Recall consolidated memories",
      description:
        "Keyword search over the NHE's temporal-lobe markdown memories (lasting + temporary classes).",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().positive().max(50).optional(),
      },
    },
    async (args) => nheRecallHandler(nhe, args),
  );

  server.registerTool(
    "nhe_sleep",
    {
      title: "Run one sleep cycle",
      description:
        "Generate a N1→REM sleep cycle, writing a dream YAML record. Does not consolidate; call nhe_wake afterwards.",
    },
    async () => nheSleepHandler(nhe),
  );

  server.registerTool(
    "nhe_wake",
    {
      title: "Consolidate pending dreams",
      description:
        "Classify each REM dream and write temporal-lobe markdown for lasting + temporary memories. Idempotent.",
    },
    async () => nheWakeHandler(nhe),
  );

  server.registerTool(
    "maic_list_axioms",
    {
      title: "List MAIC axioms",
      description: "Return the full axiom corpus held by MAIC.",
    },
    async () => maicListAxiomsHandler(maic),
  );

  server.registerTool(
    "maic_list_hims",
    {
      title: "List registered HIMs",
      description: "Return all HIMs registered with MAIC and their birth signatures.",
    },
    async () => maicListHimsHandler(maic),
  );

  return server;
}

/** Connect the MCP server to stdio and block until the transport closes. */
export async function runMcpStdio(nhe: Nhe, maic: LocalMaic): Promise<void> {
  const server = buildMcpServer(nhe, maic);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
