import {
  createAgentSession,
  createModelRuntime,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  SessionManager,
} from "./index";

// SDK consumer: configure the model and call the public API directly.
/*
Run from the project root:

bun src/coding-agent/sdk.sample.ts "Hello, what time is it now?"
*/

const cwd = process.cwd();
const provider = process.env.LOOP_AI_PROVIDER ?? DEFAULT_PROVIDER;
const modelId = process.env.LOOP_MODEL ?? DEFAULT_MODEL;
const modelRuntime = createModelRuntime({
  provider,
  modelId,
  baseUrl: process.env.LOOP_AI_BASE_URL,
  apiKey: process.env.LOOP_AI_API_KEY,
});
const model = modelRuntime.getModel(provider, modelId);

if (!model) throw new Error("Model not found: " + provider + "/" + modelId);

const { session } = await createAgentSession({
  cwd,
  model,
  modelRuntime,
  tools: ["read", "bash", "edit", "write"],
  // This minimal sample keeps history in memory across prompt calls.
  sessionManager: SessionManager.inMemory(cwd),
});
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});
const cancel = () => {
  void session.abort();
};

process.on("SIGINT", cancel);

try {
  await session.prompt(
    process.argv.slice(2).join(" ") || "Read package.json and explain how to start this project.",
  );
  process.stdout.write("\n");
} finally {
  await session.abort();
  process.off("SIGINT", cancel);
  unsubscribe();
  session.dispose();
}
