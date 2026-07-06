import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import type { Nhe } from "../nhe.js";
import { fmt } from "./output.js";

const HELP = `
Commands:
  /sleep            run a sleep cycle and immediately consolidate
  /wake             consolidate any pending sleep files
  /recall <query>   search consolidated memories
  /help             show this help
  /exit | /quit     leave the chat
Anything else is sent as a user prompt to the NHE.
`.trim();

export async function startChat(nhe: Nhe): Promise<void> {
  const rl: ReadlineInterface = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY ?? false,
  });

  let redirectAttempt = 0;
  let alive = true;

  console.log(fmt.dim(`(connected to ${nhe.id})`));
  console.log(
    fmt.dim(
      `(adapter: ${nhe.recentInteractionsBuffer.length === 0 ? "ready" : "warm"}, type /help for commands, /exit to quit)`,
    ),
  );
  console.log();

  const prompt = (): string => fmt.user("you > ");

  rl.setPrompt(prompt());
  rl.prompt();

  rl.on("line", (raw) => {
    const line = raw.trim();
    if (line.length === 0) {
      rl.prompt();
      return;
    }
    void handleLine(line)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(fmt.error(`${msg}`));
      })
      .finally(() => {
        if (alive) rl.prompt();
      });
  });

  rl.on("close", () => {
    if (alive) {
      console.log();
      console.log(fmt.dim("Bye."));
    }
  });

  // Block on close.
  await new Promise<void>((resolve) => rl.once("close", resolve));

  async function handleLine(line: string): Promise<void> {
    if (line.startsWith("/")) {
      await handleCommand(line);
      return;
    }
    await handleUserPrompt(line);
  }

  async function handleCommand(line: string): Promise<void> {
    const [cmd, ...rest] = line.slice(1).split(/\s+/);
    switch (cmd) {
      case "exit":
      case "quit":
        alive = false;
        rl.close();
        return;
      case "help":
        console.log(fmt.dim(HELP));
        return;
      case "sleep": {
        process.stdout.write(fmt.dim("• entering sleep ..."));
        const result = await nhe.sleep({ kind: "explicit" });
        console.log(fmt.dim(` wrote ${result.yamlPath}`));
        const consol = await nhe.wake();
        console.log(
          fmt.dim(
            `• wake: ${consol.memoriesWritten.length} memor${
              consol.memoriesWritten.length === 1 ? "y" : "ies"
            } persisted, ${consol.discarded} discarded`,
          ),
        );
        return;
      }
      case "wake": {
        const consol = await nhe.wake();
        console.log(
          fmt.dim(
            `• wake: ${consol.memoriesWritten.length} memor${
              consol.memoriesWritten.length === 1 ? "y" : "ies"
            } persisted, ${consol.discarded} discarded`,
          ),
        );
        return;
      }
      case "recall": {
        const query = rest.join(" ").trim();
        if (!query) {
          console.log(fmt.warn("usage: /recall <query>"));
          return;
        }
        const hits = await nhe.recall(query, { limit: 5 });
        if (hits.length === 0) {
          console.log(fmt.dim("(no matching memories)"));
          return;
        }
        for (const m of hits) {
          console.log(
            `${fmt.bold(`[${m.classification}]`)} ${fmt.dim(m.consolidatedAt)}\n  ${m.insight}\n`,
          );
        }
        return;
      }
      default:
        console.log(fmt.warn(`unknown command: /${cmd}. Try /help.`));
    }
  }

  async function handleUserPrompt(text: string): Promise<void> {
    const out = await nhe.respond({ userPrompt: text, redirectAttempt });
    if (out.kind === "ok") {
      console.log(fmt.assistant("nhe > ") + out.text);
      redirectAttempt = 0;
      return;
    }
    if (out.kind === "redirect") {
      const r = out.redirect!;
      console.log(
        fmt.warn(`(redirect ${r.attempt}/${r.maxAttempts}) `) + fmt.assistant("nhe > ") + out.text,
      );
      redirectAttempt = r.attempt;
      return;
    }
    // refused
    console.log(fmt.error("(refused) ") + out.text);
    redirectAttempt = 0;
  }
}
