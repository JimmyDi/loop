import { createInterface } from "node:readline";

import type { AgentSession } from "../../core/agent-session";
import type { AgentSessionRuntime } from "../../core/agent-session-runtime";
import type { ModelRuntime } from "../../core/model-runtime";
import { SessionManager } from "../../core/session-manager";
import { InteractiveOutput } from "./interactive-output";

export async function runInteractiveMode(
  runtime: AgentSessionRuntime,
  models: ModelRuntime,
  initialPrompt = "",
): Promise<void> {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: !!process.stdin.isTTY,
  });
  let unsubscribe = () => {};
  const tasks = new Set<Promise<void>>();
  const output = new InteractiveOutput((text) => {
    process.stdout.write(text);
  });

  const bind = (session: AgentSession) => {
    unsubscribe();
    unsubscribe = session.subscribe((event) => output.handle(event));
  };

  bind(runtime.session);
  runtime.setRebindSession(bind);
  input.setPrompt("> ");

  const handle = async (line: string) => {
    const text = line.trim();

    if (!text) return;

    if (text === "/quit") {
      if (runtime.session.state.hasPendingSave)
        throw new Error("Pending save: repair storage and use /flush before quitting");

      input.close();
      return;
    }

    if (text === "/abort") await runtime.session.abort();
    else if (text === "/flush") await runtime.session.flush();
    else if (text === "/new") await runtime.newSession();
    else if (text === "/resume") {
      const manager = runtime.session.sessionManager;
      const sessions = await SessionManager.list(runtime.cwd, manager.getSessionDir());

      for (const session of sessions) console.log(session.path);
    } else if (text.startsWith("/resume ")) await runtime.switchSession(text.slice(8).trim());
    else if (text === "/model")
      console.log(runtime.session.model.provider + "/" + runtime.session.model.id);
    else if (text.startsWith("/model ")) {
      const value = text.slice(7).trim();
      const slash = value.indexOf("/");
      const provider = slash < 0 ? runtime.session.model.provider : value.slice(0, slash);
      const id = slash < 0 ? value : value.slice(slash + 1);
      const model = models.getModel(provider, id);

      if (!model) throw new Error("Model not found: " + value);

      await runtime.session.setModel(model);
    } else if (text.startsWith("/")) throw new Error("Unknown command: " + text);
    else {
      if (runtime.session.isRunning) throw new Error("Session is already running");

      output.start();

      try {
        await runtime.session.prompt(text);
      } finally {
        output.finish();
      }
    }

    input.prompt();
  };

  const report = (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    input.prompt();
  };

  const submit = (line: string) => {
    const task = handle(line).catch(report);

    tasks.add(task);
    void task.finally(() => tasks.delete(task));
  };

  input.on("line", submit);
  input.on("SIGINT", () => {
    if (runtime.session.isRunning) void runtime.session.abort();
    else if (runtime.session.state.hasPendingSave)
      report(new Error("Pending save: repair storage and use /flush before quitting"));
    else input.close();
  });

  const terminate = () => input.close();

  process.on("SIGTERM", terminate);
  console.log("Loop · /abort /model /new /resume /quit");
  console.log("Model: " + runtime.session.model.provider + "/" + runtime.session.model.id);
  input.prompt();

  if (initialPrompt) submit(initialPrompt);

  try {
    await new Promise<void>((resolve) => input.once("close", resolve));
    await runtime.session.abort();
    await Promise.allSettled(tasks);
  } finally {
    process.off("SIGTERM", terminate);
    input.close();
    input.removeAllListeners();
    process.stdin.pause();
    unsubscribe();
    output.finish();
    runtime.setRebindSession(undefined);
  }
}
