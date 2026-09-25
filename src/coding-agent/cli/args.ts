export function parseArgs(args: string[]) {
  const flags = new Map<string, string>();
  const messages: string[] = [];
  const aliases: Record<string, string> = {
    "-p": "--print",
    "-c": "--continue",
    "-h": "--help",
    "-v": "--version",
  };
  const booleans = new Set([
    "--print",
    "--continue",
    "--no-session",
    "--help",
    "--version",
    "--no-context-files",
  ]);
  const values = new Set([
    "--model",
    "--provider",
    "--api-key",
    "--base-url",
    "--session",
    "--session-dir",
    "--system-prompt",
    "--tools",
  ]);

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];

    if (argument === "--") {
      messages.push(...args.slice(index + 1));
      break;
    }

    const name = aliases[argument] ?? argument;

    if (booleans.has(name)) flags.set(name, "true");
    else if (values.has(name)) {
      const value = args[++index];

      if (value === undefined || value.startsWith("--"))
        throw new Error("Missing value for " + name);

      flags.set(name, value);
    } else if (name.startsWith("-")) throw new Error("Unsupported option: " + name);
    else messages.push(argument);
  }

  if (["--no-session", "--session", "--continue"].filter((flag) => flags.has(flag)).length > 1)
    throw new Error("Choose only one of --session, --continue or --no-session");

  return { flags, prompt: messages.join(" ") };
}

export const HELP = [
  "Loop coding assistant",
  "bun run src/coding-agent/cli.ts [-p] [options] [prompt]",
  "--print/-p                  Print final answer and exit",
  "--model ID --provider NAME  Select a configured model",
  "--base-url URL --api-key KEY  Custom endpoint and authentication",
  "--continue/-c               Resume most recent project session",
  "--session PATH              Open a saved session",
  "--session-dir PATH          Session storage directory",
  "--no-session                In-memory session",
  "--system-prompt TEXT        Replace the base system prompt",
  "--no-context-files          Disable project instruction discovery",
  "--tools read,bash,edit,write Enable tools (empty string disables all)",
  "--help/-h --version/-v",
  "Interactive: /abort /model [provider/model] /new /resume [path] /flush /quit",
].join("\n");
