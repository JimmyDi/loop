import { createModels, createProvider, envApiKeyAuth } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

import { Agent } from "./index";

// 1. Replace this example gateway URL, model ID, and capabilities with your configuration.
const model: Model<"openai-completions"> = {
  id: "example-model",
  name: "Example Model",
  provider: "example-gateway",
  api: "openai-completions",
  baseUrl: "https://gateway.example.com/v1",
  input: ["text"],
  reasoning: false,
  contextWindow: 128000,
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
    id: "example-gateway",
    name: "Example Gateway",
    models: [model],
    auth: {
      apiKey: envApiKeyAuth("Example gateway API key", ["AGENT_EXAMPLE_API_KEY"]),
    },
    api: openAICompletionsApi(),
  }),
);

// Set AGENT_EXAMPLE_API_KEY when the gateway requires authentication.
const apiKey = process.env.AGENT_EXAMPLE_API_KEY ?? "your-api-key-here";

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
