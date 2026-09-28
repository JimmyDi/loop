# Provider Configuration

The backend stores multiple built-in and custom model providers and connects them through coding-agent's public createProviderRuntime. Pi AI owns model requests, authentication protocols, streaming events and parsing. Web implements configuration and optional catalog discovery, not model generation transports.

## HTTP API

| Route | Behavior |
| --- | --- |
| GET /api/settings/providers | Redacted providers and the built-in API-key catalog |
| POST /api/settings/providers | Create; duplicate IDs return provider_exists (409) |
| PUT /api/settings/providers/:id | Edit; the body ID must match and already exist |
| DELETE /api/settings/providers/:id | Remove configuration and stored key; preserve conversations |
| POST /api/settings/providers/discover | Fetch models for an unsaved custom provider draft |
| GET /api/models | Saved providers' models with provider IDs, providerName display labels, model IDs, names and supported efforts; empty before configuration |

Create/update/delete return the redacted collection. Input uses id, kind (builtin/custom), name, baseUrl, api, authentication, optional apiKey, and models. Models contain id and optional name, contextWindow and maxTokens. Legacy Web input/reasoning capability flags are accepted but discarded: image attachments and effort selection belong in the composer. Built-ins retain trusted catalog capabilities; custom gateways allow image content and standard effort choices without prerequisite configuration. See [form constraints](../../frontend/docs/models.md). Built-in endpoint/protocol/models are resolved from the trusted Pi AI catalog rather than accepted from request input. Custom models are limited to 500 unique IDs, with positive integer capacities no greater than 100 million; output tokens cannot exceed context.

The public record has hasApiKey instead of apiKey. Custom providers may have an empty models array; they contribute no chat models and keep their credentials for later edits. Legacy GET/PUT /api/settings/provider remains compatible with the loop-custom entry and its first model, using Chat Completions; GET returns null if that entry has no models. It does not overwrite other providers.

The model menu never falls back to the full Pi AI catalog. Only saved providers contribute entries, and Web model selection rejects models outside that list. Provider display names come from saved configuration; built-ins use their canonical catalog names. Provider IDs remain the identity for grouping and requests, even if two providers share a display name. A custom entry may use a built-in ID such as openai; kind determines whether catalog endpoint/protocol defaults apply. The custom entry retains its supplied target, protocol, authentication and selected model subset. IDs remain unique, and changing an existing entry's kind is rejected.

## Storage and Migration

The file is <agentDir>/web-ui/provider.json, normally under ~/.loop; LOOP_DATA_DIR changes the root. Version 2 contains a providers array. Reading a version 1 singleton exposes it as custom provider loop-custom without changing the file. The next successful mutation atomically writes version 2. Empty collections remain persisted so deleting all providers does not resurrect environment/catalog entries after restart.

Writes use a synced temporary file with mode 0600 followed by atomic rename. Keys are local plaintext, not encrypted in the system keychain. API responses and browser storage never contain saved keys. Invalid JSON, unsupported versions, duplicate IDs or invalid entries fail closed with provider_config_invalid; content is never included in the error.

Omitting apiKey preserves it only for the same normalized URL and protocol. A changed target requires a fresh key. No authentication deletes stored credentials and supplies Pi AI with the non-sensitive local-placeholder key; gateways must tolerate its authentication header. Keys never fall through from other configured providers.

The separate provider.json.selection file contains only the last Web-selected provider/model and optional effort. Invalid or removed selections fall back to the first configured model for new sessions. This Web preference does not change coding-agent settings.json or CLI defaults.

## Discovery

Discovery first checks the draft Provider ID against the built-in catalog. An exact match returns all its model IDs, names and capacities locally, without querying the supplied Base URL or resolving credentials. For other IDs, discovery supports the three custom protocols. It requests GET <baseUrl>/models, with Anthropic's /v1 and x-api-key/anthropic-version headers as needed; OpenAI protocols use bearer authentication. savedId may reuse a stored key only for the same URL and protocol. A supplied key is transient and never persisted by discovery.

Endpoint responses accept a data array or models map, limited to 2 MiB and 500 IDs. Valid contextWindow/context_window and maxTokens/max_tokens/max_output_tokens values are retained; invalid capacities are omitted. Requests time out after 10 seconds and do not follow redirects. Errors return provider_discovery_failed without echoing upstream bodies or credentials. The frontend merges all returned models into the editable draft, keeping existing per-model edits; persistence still requires Save. Local catalog entries do not claim gateway availability. Manual IDs work independently of discovery. This operation reads the model catalog; it does not call generation endpoints.

## Session Lifecycle

Custom runtime construction resolves the exact provider/model ID's Pi AI thinking-level mapping. The model API and session validation therefore allow xhigh/max only when supported and retain catalog exclusions for other levels. The map is runtime metadata rather than a new persisted provider field, and configured endpoints, protocols and credentials are unchanged. Unknown identities keep the standard effort defaults.

A stable runtime facade resolves the latest configuration for every preflight and request. Once a provider file exists, only configured models can run. With no file, legacy SDK/environment setup remains available. Built-in models retain their individual protocols, endpoints and metadata.

New sessions select a valid remembered Web model or the first configured model. Existing sessions retain their selection. Web opts into createAgentSession's allowUnavailableModel restoration mode so removed models do not prevent reading history; prompt preflight still rejects until a configured model is explicitly selected. Re-adding the same identity also permits continuation.

SessionRegistry.configure rejects mutations during execution, loading, switching, pending saves or project removal with provider_busy (409), and blocks new operations until the mutation finishes. There is no mid-request connection switch or automatic abort/retry. Discovery neither mutates configuration nor changes sessions.

## Limits

No OAuth, account login, keychain integration, automatic connection test, external-file watching or host-editor opener. API-key catalog providers that need additional platform configuration are excluded. Saved configuration is read on initialization and after application mutations; restart after manual file edits. Provider settings apply to Web only.

## Source and Tests

- [Routes](../routes/providers.ts) / [tests](../routes/providers.test.ts).
- [Validation](../providers/validate-provider-config.ts) / [tests](../providers/validate-provider-config.test.ts).
- [ProviderStore](../providers/provider-store.ts) / [tests](../providers/provider-store.test.ts).
- [ProviderSettings](../providers/provider-settings.ts) / [tests](../providers/provider-settings.test.ts).
- [Discovery](../providers/discover-models.ts) / [tests](../providers/discover-models.test.ts).
- [History and defaults](../loop.test.ts), [SDK models](../../../coding-agent/docs/models.md).
