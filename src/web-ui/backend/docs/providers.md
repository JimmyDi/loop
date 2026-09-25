# Provider Configuration

The backend stores one OpenAI Chat Completions-compatible provider and connects it to Agent through coding-agent's public createModelRuntime. Web does not implement provider network protocols or import the Pi AI runtime directly.

## API and Input

`GET /api/settings/provider` returns public configuration or null. `PUT /api/settings/provider` validates and saves configuration, returning the same redacted view. See [frontend model settings](../../frontend/docs/models.md) for browser usage.

| Field | Contract |
| --- | --- |
| name | Nonempty display name, at most 100 characters |
| baseUrl | HTTP(S) API base URL, at most 2048 characters |
| modelId | A service-supported model ID, at most 200 characters |
| authentication | apiKey or none |
| apiKey | Optional write-only string, at most 8192 characters; never returned |

URLs cannot include a username/password, query, fragment, or a path ending in `/chat/completions` or `/responses`. URLs are normalized and trailing slashes removed before saving. The display name is not the provider identity; the internal ID is always loop-custom.

The public view includes provider, hasApiKey, and other non-sensitive configuration fields. `GET /api/models` returns id/provider/name for the custom model and built-in catalog, without keys. Catalog membership does not prove authentication or connectivity.

## Credential Storage

The file is `<agentDir>/web-ui/provider.json`, defaulting to `~/.loop/web-ui/provider.json`. LOOP_DATA_DIR can change the root. The file uses version 1, is written and synced through a temporary file, and is atomically replaced with mode 0600. Keys are stored as local plaintext, not encrypted by the system keychain.

Omitting apiKey preserves a saved key only for the same normalized URL. Changing the URL requires a new key. API-key mode without a usable key returns provider_key_required. none mode deletes the stored key and supplies a non-sensitive placeholder to the SDK, avoiding inherited environment credentials.

Corrupt files or unsupported versions return provider_config_invalid without exposing file content. The browser does not persist keys, and APIs do not return them. Session headers store model identity, not this authentication configuration.

## Scope and Mutual Exclusion

New sessions default to the saved custom model. Restored and open sessions retain their selection. `PUT /api/sessions/:id/model` switches an idle session to the custom model while preserving history. Saving configuration does not automatically call this endpoint.

After URL or key changes for the same custom provider/model, a stable runtime facade resolves the latest configuration on the next request without rebuilding AgentSession. Changing modelId requires open sessions to select the new ID. If history saved with an old ID cannot be restored, restore the original configuration before opening it. Another model is never substituted silently.

SessionRegistry.configure blocks new session operations during saving. Active execution, loading, model changes, pending saves, or project removal reject an update with provider_busy (409). There is no connection switch mid-request, automatic abort, queue, or model retry.

## Limits

Only one custom provider and model configuration is supported. There is no multi-configuration management, OAuth, model discovery, delete-configuration API, or connection test. Saving does not request a model; an actual prompt verifies connectivity and model support. Built-in models and unconfigured defaults keep SDK configuration/environment authentication. Web settings do not change CLI/SDK defaults.

## Source and Tests

- [Routes](../routes/providers.ts) / [redaction and busy-state tests](../routes/providers.test.ts).
- [Validation](../providers/validate-provider.ts) / [tests](../providers/validate-provider.test.ts).
- [ProviderStore](../providers/provider-store.ts) / [permissions, keys, and corrupt-file tests](../providers/provider-store.test.ts).
- [ProviderSettings](../providers/provider-settings.ts) / [local HTTP request and configuration-update tests](../providers/provider-settings.test.ts).
- [Shared types](../../shared/provider.ts), [SDK model documentation](../../../coding-agent/docs/models.md).
