import { createModels, createProvider, envApiKeyAuth } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

import { Agent } from "./index";

// 1. Configure the model exposed by Maestro.
const model: Model<"openai-completions"> = {
  id: "gpt-6-astra",
  name: "GPT-6 Astra via Maestro",
  provider: "agent-maestro",
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:23333/api/openai/v1",
  input: ["text", "image"],
  reasoning: true,
  contextWindow: 921793,
  maxTokens: 4096,
  // Local accounting placeholders, not actual pricing.
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
};

const models = createModels();

models.setProvider(
  createProvider({
    id: "agent-maestro",
    name: "Agent Maestro",
    models: [model],
    auth: {
      apiKey: envApiKeyAuth("Maestro API key", ["AGENT_MAESTRO_API_KEY"]),
    },
    api: openAICompletionsApi(),
  }),
);

// Set the matching key if Maestro authentication is enabled.
const apiKey = process.env.AGENT_MAESTRO_API_KEY ?? "local-placeholder";

// 2. Create an Agent using the package's public entry point.
const agent = new Agent({
  model,
  systemPrompt: "You are a helpful coding assistant.",
  tools: [],
  streamFn: (requestModel, context, options) =>
    models.streamSimple(requestModel, context, {
      ...options, // Preserve the Agent's cancellation signal and request options.
      apiKey,
    }),
});

// 3. Print text as it arrives. prompt() still resolves with the final AssistantMessage.
const unsubscribe = agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await agent.prompt("用一个简单例子解释 agent loop。");
} finally {
  unsubscribe();
  process.stdout.write("\n");
}
