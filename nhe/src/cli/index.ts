import { SEED_AXIOMS } from "@teleologyhi-sdk/maic";
import {
  type DetectedAdapter,
  type DetectOptions,
  detectAdapter,
  isAdapterName,
} from "./adapter-detection.js";
import { bootstrap } from "./bootstrap.js";
import { startChat } from "./chat.js";
import { runMcpStdio } from "./mcp.js";
import { fmt } from "./output.js";

interface ParsedArgs {
  subcommand: string;
  flags: Record<string, string>;
  positional: string[];
}

const HELP_TEXT = `
@teleologyhi-sdk/nhe, CLI

Usage:
  teleologyhi-nhe <command> [options]

Commands:
  chat                       start an interactive chat session (default)
  mcp                        run as a Model Context Protocol stdio server
  help                       show this help

Options for chat / mcp:
  --store-dir <path>         directory for MAIC/HIM/NHE state (default ./teleologyhi-store)
  --adapter <name>           force adapter: anthropic | gemini | mistral | deepseek | grok | ollama
  --model <name>             model id (adapter-specific)
  --ollama-base-url <url>    Ollama base URL (default http://localhost:11434)
  --archetype <id>           primary archetype for a fresh HIM (default aries-sun)
  --him-id <id>              persistent HIM id (default him.cli.default)

Environment (auto-selection order when --adapter is omitted):
  ANTHROPIC_API_KEY   auto-selects AnthropicAdapter (claude-sonnet-4-6)
  GEMINI_API_KEY      auto-selects GeminiAdapter (gemini-3.5-flash)
  MISTRAL_API_KEY     auto-selects MistralAdapter (mistral-large-latest)
  DEEPSEEK_API_KEY    auto-selects DeepSeekAdapter (deepseek-chat)
  XAI_API_KEY         auto-selects GrokAdapter (grok-4)
  (fallback)          auto-detects local Ollama at default port

Examples:
  teleologyhi-nhe chat
  teleologyhi-nhe chat --adapter ollama --model qwen2.5:7b
  teleologyhi-nhe chat --adapter gemini --model gemini-3.5-flash
  teleologyhi-nhe chat --adapter mistral --model mistral-small-latest
  teleologyhi-nhe chat --adapter deepseek --model deepseek-reasoner
  teleologyhi-nhe chat --adapter grok --model grok-4-fast
`.trim();

export async function runCli(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  switch (parsed.subcommand) {
    case "chat":
    case "":
      return chatCommand(parsed);
    case "mcp":
      return mcpCommand(parsed);
    case "help":
    case "--help":
    case "-h":
      console.log(HELP_TEXT);
      return 0;
    default:
      console.error(fmt.error(`unknown command: ${parsed.subcommand}`));
      console.error(HELP_TEXT);
      return 2;
  }
}

async function mcpCommand(args: ParsedArgs): Promise<number> {
  const detect: DetectOptions = {};
  const adapterFlag = args.flags.adapter;
  if (isAdapterName(adapterFlag)) {
    detect.adapter = adapterFlag;
  }
  const modelFlag = args.flags.model;
  if (modelFlag) detect.model = modelFlag;
  const ollamaUrlFlag = args.flags["ollama-base-url"];
  if (ollamaUrlFlag) detect.ollamaBaseUrl = ollamaUrlFlag;

  let detected: DetectedAdapter;
  try {
    detected = await detectAdapter(detect);
  } catch (e: unknown) {
    // MCP runs on stdio; surface errors via stderr only.
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }

  const result = await bootstrap({
    llmAdapter: detected.adapter,
    ...(args.flags["store-dir"] ? { storeDir: args.flags["store-dir"] } : {}),
    ...(args.flags["him-id"] ? { himId: args.flags["him-id"] } : {}),
    ...(args.flags.archetype ? { archetype: args.flags.archetype } : {}),
  });

  // Only stderr gets bootstrap notes, stdout is reserved for MCP protocol.
  process.stderr.write(
    `[@teleologyhi-sdk/nhe mcp] storeDir=${result.storeDir} him=${result.him.id} adapter=${detected.source}:${detected.model}\n`,
  );

  await runMcpStdio(result.nhe, result.maic);
  return 0;
}

async function chatCommand(args: ParsedArgs): Promise<number> {
  const detect: DetectOptions = {};
  const adapterFlag = args.flags.adapter;
  if (isAdapterName(adapterFlag)) {
    detect.adapter = adapterFlag;
  }
  const modelFlag = args.flags.model;
  if (modelFlag) detect.model = modelFlag;
  const ollamaUrlFlag = args.flags["ollama-base-url"];
  if (ollamaUrlFlag) detect.ollamaBaseUrl = ollamaUrlFlag;

  let detected: DetectedAdapter;
  try {
    detected = await detectAdapter(detect);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(fmt.error(msg));
    return 1;
  }

  const result = await bootstrap({
    llmAdapter: detected.adapter,
    ...(args.flags["store-dir"] ? { storeDir: args.flags["store-dir"] } : {}),
    ...(args.flags["him-id"] ? { himId: args.flags["him-id"] } : {}),
    ...(args.flags.archetype ? { archetype: args.flags.archetype } : {}),
  });

  if (result.freshInstall) {
    console.log(fmt.dim(`• fresh setup at ${result.storeDir}`));
    console.log(fmt.dim(`• Creator keyring saved to ${result.storeDir}/creator.pem`));
    console.log(
      fmt.dim(`• MAIC seeded with ${SEED_AXIOMS.length} axioms; HIM "${result.him.id}" minted`),
    );
  } else {
    console.log(fmt.dim(`• reopened ${result.storeDir} (HIM "${result.him.id}")`));
  }
  console.log(fmt.dim(`• adapter: ${detected.source}:${detected.model}`));
  console.log();

  await startChat(result.nhe);
  return 0;
}

function parseArgs(argv: string[]): ParsedArgs {
  const subcommand = argv[0] ?? "";
  const rest = argv.slice(1);
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i]!;
    if (tok.startsWith("--")) {
      const name = tok.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = "";
      }
    } else {
      positional.push(tok);
    }
  }
  return { subcommand, flags, positional };
}

// Direct invocation (this file is the bin entry).
const isMain = import.meta.url === `file://${process.argv[1] ?? ""}`;
if (isMain) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
