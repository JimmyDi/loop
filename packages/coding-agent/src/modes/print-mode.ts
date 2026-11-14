import type { AgentSessionRuntime } from "../core/agent-session-runtime";
import { messageText } from "../core/messages";

export async function runPrintMode(runtime: AgentSessionRuntime, prompt: string): Promise<void> {
  if (!prompt.trim()) throw new Error("Prompt is required in print mode");

  await runtime.session.prompt(prompt);

  const plan = runtime.session.state.planning?.plans.at(-1);
  const text =
    plan?.status === "ready"
      ? plan.title + "\n\n" + plan.markdown
      : messageText(runtime.session.state.messages.at(-1));

  await new Promise<void>((resolve, reject) => {
    process.stdout.write(text + "\n", (error) => (error ? reject(error) : resolve()));
  });
}
