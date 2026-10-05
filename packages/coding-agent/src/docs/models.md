# Models and Custom URLs

`createModelRuntime` configures model lookup, authentication checks, and the stream function injected into Agent. Provider networking and response parsing remain in the model runtime.

## Defaults

New sessions default to provider `openai` and model `gpt-5.5`. Without a custom URL, the catalog model uses OpenAI Responses. Configure `OPENAI_API_KEY` or `LOOP_AI_API_KEY` before running a sample.

For new CLI sessions, flags override environment values, then [settings](settings.md), then built-in defaults. A resumed session restores its saved model unless `--model` explicitly overrides it. `--provider` by itself does not replace a resumed session's model.

In the SDK, an explicit `model` overrides the manager's saved identity; otherwise resolution uses saved identity, environment, settings, and defaults in that order. By default, model metadata must be available in the supplied runtime; unavailable models reject rather than silently falling back. Hosts can opt into allowUnavailableModel when restoring saved history: the original identity is retained and history opens without an authentication check, but prompts still require a configured model.

## OpenAI-compatible endpoint

Use the API base URL, excluding `/chat/completions`. For a local endpoint that has authentication disabled, a placeholder key can satisfy the authentication check:

```bash
export LOOP_AI_PROVIDER=openai
export LOOP_MODEL=gpt-5.5
export LOOP_AI_BASE_URL="http://localhost:8080/v1"
export LOOP_AI_API_KEY="local-placeholder"

pnpm run coding-agent
node --conditions=loop-source --import tsx packages/coding-agent/src/sdk.sample.ts "Hello!"
```

Replace the URL with your running gateway's URL. If authentication is enabled, supply its real key through the environment. Separate shell assignments require `export`; CLI flags used in a previous process do not configure a later SDK process. The application CLI loads a local .env; SDK callers configure the environment explicitly.

The CLI accepts `--base-url` and `--api-key`. The SDK accepts the same values through runtime options:

```typescript
import { createModelRuntime } from "@loop/coding-agent";

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

Gateway-created models use available catalog input/reasoning/context metadata and thinking-level mappings, 4096 maximum output tokens, and zero local cost placeholders. Unknown models assume text input, no reasoning, and a 128K context. These are configuration assumptions, not detected server capabilities or a claim of free inference.

## Host registry and switching

`createModelRuntime({ models, provider, modelId, apiKey, baseUrl })` accepts a `Models` registry created/registered by the host. Loop preserves its API implementation. Base URL and key overrides apply to the configured provider. Use a host registry when exact capabilities or a different protocol are needed; see the lower-level [Agent sample](../../../agent/src/agent.sample.ts) for provider registration.

The runtime exposes `getModel`, `getModels`, `checkModel`, and `streamSimple`. Authentication checks resolve credentials; they do not make a test inference or prove endpoint connectivity.

Use `session.setModel(model)` while idle. It records model identity in this session, not global defaults. `persist: true` rejects; edit settings for future sessions. Endpoint and credentials must be supplied again after restart.

## Reasoning effort

getModelEfforts(model) returns Default plus the supported levels for a reasoning model, or an empty array for a model without reasoning. ModelEffort is default, off, minimal, low, medium, high, xhigh or max. Availability is model-specific; unsupported explicit values reject.

Pass effort to createAgentSession or session.setModel(model, { effort }). It persists with the session and restores on reopen. A model switch retains the level when supported, otherwise uses Default. Default and Off omit the simple reasoning option; the model runtime retains the model's native default/disabled behavior. Other levels flow through Agent's existing streamOptions to the model runtime on every model turn. An effort change does not call a model or alter message history.

## Provider catalog and isolated runtimes

getProviderCatalog() returns API-key providers with their model metadata, excluding providers requiring additional platform configuration or OAuth. createProviderRuntime(config) creates an isolated model registry for one built-in or custom provider. Built-in models retain their own endpoints, protocols and capabilities.

```typescript
import { createProviderRuntime } from "@loop/coding-agent";

const modelRuntime = createProviderRuntime({
  id: "example-gateway",
  kind: "custom",
  name: "Example gateway",
  baseUrl: "http://localhost:8080/v1",
  api: "openai-responses",
  authentication: "none",
  models: [{ id: "example-model", contextWindow: 128000, maxTokens: 4096 }],
});
const model = modelRuntime.getModel("example-gateway", "example-model");
```

Custom protocols are openai-completions, openai-responses and anthropic-messages. For Anthropic, a final /v1 is normalized before the model runtime appends its request path. API-key mode requires an explicit key and does not inherit another provider's credentials. No-auth mode supplies a non-sensitive local-placeholder key; the target must accept its header. Custom provider metadata defaults to text/image input, standard reasoning levels, 128K context and at most 4096 output tokens. These defaults allow users to request images and effort without a setup checkbox; the gateway determines actual support and can reject unsupported requests. SDK callers can still override input/reasoning metadata explicitly. For custom providers, Default/Off sends no explicit reasoning settings; choosing another effort enables reasoning parameters for that request. Web exposes these choices in the composer.

Custom provider models inherit thinkingLevelMap from an exact model catalog provider/model ID match. This enables xhigh/max only where the catalog supports them and preserves unsupported-level exclusions and provider-specific wire values. Gateway URL, protocol, credentials and editable metadata remain custom. Unknown IDs retain standard levels through high; this path does not guess a different provider by model name. The mapping is resolved when creating the runtime and is not persisted in provider configuration. Ultra is not a supported ModelEffort value.

Web composes isolated runtimes and persists their configuration through its [provider service](../../../web-ui/src/backend/docs/providers.md). These functions alone do not write files, discover models or modify CLI defaults.

## Source

[model-runtime.ts](../core/model-runtime.ts), [sdk.ts](../core/sdk.ts), and [model-runtime.test.ts](../core/model-runtime.test.ts).
