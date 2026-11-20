import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import { saveSandboxConnection, sandboxUrl } from "../core/execution/connection";

export const connectSandbox = async (args: string[]): Promise<number> => {
  if (args.some((arg) => arg !== "--file")) throw new Error("Usage: loop sandbox connect [--file]");
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new Error(
      "Connection setup requires an interactive terminal; use environment variables for automation",
    );
  let muted = false;
  const output = new Writable({
    write: (chunk, _encoding, done) => {
      if (!muted) process.stderr.write(chunk);
      done();
    },
  });
  const input = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  input.on("SIGINT", () => abort.abort());
  try {
    const url = sandboxUrl(
      (
        await input.question("Sandbox URL [http://127.0.0.1:8080/mcp/]: ", { signal: abort.signal })
      ).trim() || "http://127.0.0.1:8080/mcp/",
    );
    process.stderr.write("Token (hidden): ");
    muted = true;
    const token = await input.question("", { signal: abort.signal });
    muted = false;
    process.stderr.write("\n");
    saveSandboxConnection(url, token.trim(), args.includes("--file"));
    console.log("Sandbox connection saved. Start with --sandbox or select Sandbox in Web.");
    return 0;
  } finally {
    input.close();
    output.destroy();
  }
};
