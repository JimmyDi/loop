import { resolve } from "node:path";

import { HELP, parseArgs } from "./cli/args";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, getAgentDir, getSessionDir, VERSION } from "./config";
import { createAgentSessionRuntime } from "./core/agent-session-runtime";
import { createModelRuntime } from "./core/model-runtime";
import { createAgentSession } from "./core/sdk";
import { SessionManager } from "./core/session-manager";
import { SettingsManager } from "./core/settings-manager";
import { recoverPendingSave } from "./modes/save-recovery";
import { runInteractiveMode, runPrintMode } from "./modes";

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { flags, prompt } = parseArgs(args);

  if (flags.has("--help")) {
    console.log(HELP);
    return 0;
  }

  if (flags.has("--version")) {
    console.log(VERSION);
    return 0;
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const settingsManager = await SettingsManager.create(agentDir);
  const provider =
    flags.get("--provider") ??
    process.env.LOOP_AI_PROVIDER ??
    settingsManager.defaultModel?.provider ??
    DEFAULT_PROVIDER;
  const id =
    flags.get("--model") ??
    process.env.LOOP_MODEL ??
    settingsManager.defaultModel?.id ??
    DEFAULT_MODEL;
  const modelRuntime = createModelRuntime({
    provider,
    modelId: id,
    apiKey: flags.get("--api-key"),
    baseUrl: flags.get("--base-url"),
  });
  const directory = flags.has("--session-dir")
    ? resolve(flags.get("--session-dir")!)
    : getSessionDir(cwd, agentDir);
  const sessionManager = flags.has("--no-session")
    ? SessionManager.inMemory(cwd)
    : flags.has("--session")
      ? await SessionManager.open(resolve(flags.get("--session")!))
      : flags.has("--continue")
        ? await SessionManager.continueRecent(cwd, directory)
        : await SessionManager.create(cwd, directory);
  const model =
    flags.has("--model") || !sessionManager.getHeader().model
      ? modelRuntime.getModel(provider, id)
      : undefined;

  if (flags.has("--model") && !model) throw new Error("Model not found: " + provider + "/" + id);

  const runtime = await createAgentSessionRuntime(
    (options) =>
      createAgentSession({
        ...options,
        agentDir,
        modelRuntime,
        settingsManager,
        tools: flags.has("--tools") ? flags.get("--tools")!.split(",").filter(Boolean) : undefined,
        systemPrompt: flags.get("--system-prompt"),
        noContextFiles: flags.has("--no-context-files"),
      }),
    { cwd: sessionManager.getCwd(), sessionManager, model },
  );
  let signalCode = 0;
  const interrupt = () => {
    signalCode = 130;
    void runtime.session.abort();
  };
  const terminate = () => {
    signalCode = 143;
    void runtime.session.abort();
  };
  const print = flags.has("--print");

  if (print) process.on("SIGINT", interrupt);

  process.on("SIGTERM", terminate);

  try {
    if (print) await runPrintMode(runtime, prompt);
    else await runInteractiveMode(runtime, modelRuntime, prompt);

    return signalCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));

    return signalCode || 1;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    await recoverPendingSave(runtime.session);
    await runtime.dispose();
  }
}
