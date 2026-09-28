# Model Providers

Open **Settings → Models** before or after adding a project. General, Models and Appearance share the same dialog. The former standalone Model settings button is removed.

## Add and Edit

The page lists only saved providers with Edit and Delete actions. With no saved providers, it starts empty and offers Add provider and Add a custom provider; deleting the last provider returns to this empty state. A red dot means a key is required; green means configured, not that connectivity has been tested.

**Add provider** uses Pi AI's built-in API-key provider catalog. Select a provider and enter its key; endpoints, native protocols and model metadata come from the catalog. Providers requiring OAuth or additional platform configuration are excluded.

**Add a custom provider** supports multiple independent gateways and models:

| Field | Contract |
| --- | --- |
| Provider ID | Lowercase letter followed by lowercase letters, numbers or hyphens, at most 80 characters; immutable after creation |
| Provider name | Display name, at most 100 characters |
| Base URL | HTTP(S) API base URL, without credentials, query, fragment or completion endpoint |
| API protocol | OpenAI Chat Completions, OpenAI Responses, or Anthropic Messages |
| Authentication | API key, or No authentication for a local gateway |
| API key | Write-only password field; saved keys are never filled back in |
| Models | Up to 500 unique model IDs; optional display name, context window and output token limit; an empty list disables this provider's models |

Anthropic accepts a base URL with or without a final /v1. Custom models without capacity settings default to a 128K context and at most 4096 output tokens. Fetch preserves available capacity metadata for editing. Add images as message attachments and choose Effort in the composer; neither requires a provider checkbox. Custom gateways accept these requested options through Pi AI, while actual support is determined by the service. Built-in models retain their catalog capabilities.

For a custom provider, **Fetch available models** first matches the Provider ID against Pi AI's built-in catalog. An exact match such as openai adds that entire catalog without contacting the gateway or requiring a key for discovery. Otherwise it queries the draft endpoint's models catalog. The local catalog does not verify which models the gateway serves. The custom Base URL, protocol and authentication stay as entered. An ID must be unique across saved providers, so built-in and custom entries cannot share the same ID.

Fetch adds all returned models directly as editable rows, replacing blank placeholders and preserving existing models and edits with the same ID. There are no candidate checkboxes or Add selected step. Each row shows Model ID and Display name; its arrow expands Context window and Maximum output tokens. The trash button removes that model, including the final row. Saving applies the remaining list to the chat menu; Cancel discards draft edits. Fetching again can restore deleted models. Empty results and errors preserve the current list, and manual entry remains available. The form and Save action are disabled while fetching. Discovery never generates a response, saves the draft, or runs on every keystroke.

The custom provider editor has a viewport-bounded height and only the model list scrolls. Connection fields, the dialog header, Fetch, Add model and Save/Cancel stay outside that scrolling area. The list uses the remaining height, so fetching models or expanding rows does not grow the dialog. Connection fields use two columns where possible; in shorter windows, helper text remains available through field/button tooltips and accessible descriptions to preserve list space.

## Model Selection and History

The pill beside Send in the input box opens a menu with **Model** and, for reasoning models, **Effort**. The old header selector is removed. Model lists only models from saved providers, with a checkmark for the current model. Without saved providers, the list is empty; it never falls back to the full Pi AI catalog. Section headings use each provider's saved display name, including the catalog's canonical name for built-in providers. Search matches these names as well as provider IDs, model IDs and model names.

New sessions use the last model selected through the Web session menu when it remains configured; otherwise they use the first configured provider's first model. The preference persists on the server and does not change CLI/SDK defaults. Saving a provider does not switch existing sessions. URL/key edits take effect on their next request.

Deleting a provider removes its saved credentials and models. Saved conversations remain readable, including after a restart. A conversation whose model was removed keeps its original identity and requires an explicit model selection before generating again. Models are never silently substituted in an existing conversation. Deleting the final provider leaves the managed model menu empty.

## Effort and Composer Interaction

Effort lists only the selected model's Pi AI-supported levels. Default preserves existing provider behavior without an explicit reasoning level. Off disables optional thinking where the model supports it. Other levels are translated by Pi AI into each provider's request parameters; models without reasoning support omit this row. Custom models offer the standard effort levels directly without a capability checkbox. Default sends no explicit reasoning setting for custom gateways; a selected level is passed to Pi AI on the next request. Older Web capability flags are ignored when reading configuration. A service that cannot handle the requested feature may reject the message.

Custom models whose Provider ID and model ID match the Pi AI catalog inherit its thinking-level mapping automatically. Extra high (xhigh) and Maximum (max) appear only when supported; catalog exclusions also apply to lower levels. Unmatched models retain the standard choices through High. Ultra is not a supported effort value. Existing saved providers need no re-fetch or re-save; mappings are resolved when the backend builds their runtime. These mappings do not change the configured Base URL or protocol or prove gateway support.

Model and effort changes persist together in session metadata, retain history/drafts, and become the default for future Web sessions. Existing sessions retain their own choices. Switching to a model without the current effort resets it to Default. Generation, disconnection, pending saves or unconfirmed delivery disable configuration; a pending configuration request blocks Send. Failures keep the prior selection and show an error.

The popover opens above the input box. Its trigger chevron points down when closed and up while open, including in submenus. Enter/Space or Up/Down opens it; arrow keys and Home/End move through items, Right enters a submenu, Left returns, and Escape closes and restores trigger focus. Tab resumes normal tab order. Outside clicks dismiss it. Model search matches provider, ID and display name. Empty catalogs direct users to Settings → Models. Narrow screens keep the menu inside the viewport and hide the keyboard hint to preserve space.

## Privacy, Errors and Keyboard Access

Keys stay in form state until submitted and never enter browser persistence or the query cache. Leaving a key empty preserves the saved key only when both normalized URL and protocol are unchanged. Changing either requires re-entry. No authentication removes the saved key. Switching the built-in provider in a new form clears a previously typed key.

Save failures retain the draft. Provider changes are rejected while session operations, loading or pending saves are active. Save and discovery errors appear inline. Successful saves refresh provider rows and model menus without reloading the page. Settings, editor and delete confirmation use native modal dialogs; Escape closes only the top dialog and focus returns to its trigger. Closing is disabled while a save/delete is pending.

The interface supports Chinese, English, light/dark themes and narrow screens. It does not include OAuth login, a connectivity test, or a host-editor configuration-file opener. Configuration is edited through the form; external file edits require a backend restart.

## Source and Tests

- [ModelsSettings](../components/settings/ModelsSettings.tsx) / [tests](../components/settings/ModelsSettings.test.tsx).
- [ProviderForm](../components/settings/ProviderForm.tsx) / [tests](../components/settings/ProviderForm.test.tsx).
- [ProviderModels](../components/settings/ProviderModels.tsx) / [tests](../components/settings/ProviderModels.test.tsx).
- [ProviderModelRow](../components/settings/ProviderModelRow.tsx) / [tests](../components/settings/ProviderModelRow.test.tsx).
- [useProviderForm](../hooks/useProviderForm.ts) / [tests](../hooks/useProviderForm.test.tsx).
- [useProviderSettings](../hooks/useProviderSettings.ts) / [tests](../hooks/useProviderSettings.test.tsx).
- [ComposerModelSettings](../components/chat/ComposerModelSettings.tsx) / [tests](../components/chat/ComposerModelSettings.test.tsx).
- [ModelChoices](../components/chat/ModelChoices.tsx) / [tests](../components/chat/ModelChoices.test.tsx).
- [useModelSelection](../hooks/useModelSelection.ts) / [tests](../hooks/useModelSelection.test.tsx).
- [Backend provider contract](../../backend/docs/providers.md).
