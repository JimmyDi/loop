# Models and Custom URLs

`createModelRuntime` configures Pi AI model lookup, authentication checks, and the stream function injected into Agent. Provider networking and response parsing remain in Pi AI.

## Defaults

New sessions default to provider `openai` and model `gpt-5.5`. Without a custom URL, the catalog model uses OpenAI Responses. Configure `OPENAI_API_KEY` or `LOOP_AI_API_KEY` before running a sample.

For new CLI sessions, flags override environment values, then [settings](settings.md), then built-in defaults. A resumed session restores its saved model unless `--model` explicitly overrides it. `--provider` by itself does not replace a resumed session's model.

In the SDK, an explicit `model` overrides the manager's saved identity; otherwise resolution uses saved identity, environment, settings, and defaults in that order. Model metadata must be available in the supplied runtime; unavailable models reject rather than silently falling back.

## OpenAI-compatible endpoint

Use the API base URL, excluding `/chat/completions`. For a local endpoint that has authentication disabled, a placeholder key can satisfy Pi AI's authentication check:

```bash
export LOOP_AI_PROVIDER=openai
export LOOP_MODEL=gpt-5.5
export LOOP_AI_BASE_URL="http://localhost:8080/v1"
export LOOP_AI_API_KEY="local-placeholder"

bun run coding-agent
bun src/coding-agent/sdk.sample.ts "Hello!"
```

Replace the URL with your running gateway's URL. If authentication is enabled, supply its real key through the environment. Separate shell assignments require `export`; CLI flags used in a previous process do not configure a later SDK process. Bun also loads a local `.env`.

The CLI accepts `--base-url` and `--api-key`. The SDK accepts the same values through runtime options:

```typescript
import { createModelRuntime } from "./src/coding-agent";

const modelRuntime = createModelRuntime({
  provider: "openai",
  modelId: "gpt-5.5",
  baseUrl: process.env.LOOP_AI_BASE_URL,
  apiKey: process.env.LOOP_AI_API_KEY,
});
const model = modelRuntime.getModel("openai", "gpt-5.5");

if (!model) throw new Error("Model not found");
```

Pass both `modelRuntime` and `model` to [createAgentSession](sdk.md). Runtime provider/model settings determine registration and credential overrides; explicitly selecting the model avoids a session's saved/default selection choosing another model.

## Protocol and metadata

Without a host registry, a custom URL registers Chat Completions for the OpenAI provider or for an unknown provider/model pair. A named gateway can reuse known OpenAI catalog metadata. Existing models on other providers retain their registered protocol; a URL override does not translate protocols.

Gateway-created models use available catalog input/reasoning/context metadata, 4096 maximum output tokens, and zero local cost placeholders. Unknown models assume text input, no reasoning, and a 128K context. These are configuration assumptions, not detected server capabilities or a claim of free inference.

## Host registry and switching

`createModelRuntime({ models, provider, modelId, apiKey, baseUrl })` accepts a Pi AI `Models` registry created/registered by the host. Loop preserves its API implementation. Base URL and key overrides apply to the configured provider. Use a host registry when exact capabilities or a different protocol are needed; see the lower-level [Agent sample](../../agent/agent.sample.ts) for Pi AI provider registration.

The runtime exposes `getModel`, `getModels`, `checkModel`, and `streamSimple`. Authentication checks resolve credentials; they do not make a test inference or prove endpoint connectivity.

Use `session.setModel(model)` while idle. It records model identity in this session, not global defaults. `persist: true` rejects; edit settings for future sessions. Endpoint and credentials must be supplied again after restart.

## Source

[model-runtime.ts](../core/model-runtime.ts), [sdk.ts](../core/sdk.ts), and [model-runtime.test.ts](../core/model-runtime.test.ts).
