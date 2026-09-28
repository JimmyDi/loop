# Changelog

Notable changes across Agent, coding-agent, and Web UI are recorded here. Pending changes accumulate under Unreleased; release preparation groups them by version and date. See [Contributing](CONTRIBUTING.md#changelog) for the maintenance workflow.

## [Unreleased]

### Added

- coding-agent and Web UI: generate durable conversation titles asynchronously from user prompts, with first-user-message fallback names for new and untitled historical sessions, manual renaming, explicit regeneration, and live header/sidebar updates. Empty sessions show New session. Web uses the first prompt; SDK hosts can choose first-prompt or all-prompts generation and a separate model. Failed or stale title requests do not replace accepted titles or affect the main conversation.
- Web UI: add a Settings dialog with General, Models and Appearance tabs, keyboard navigation, and focus restoration.
- Web UI: initialize the interface language from the browser's supported languages and remember manual Chinese or English selections without reloading or interrupting conversations.
- Web UI: add System, Light, and Dark theme previews and persist the selected theme across visits. System follows browser color-scheme changes. Theme styling requires Chrome/Edge 123+, Firefox 120+, or Safari 17.5+.
- Web UI: manage multiple built-in and custom providers with write-only credentials, three custom API protocols, model discovery and editable model metadata. Fetch adds all models from the matching built-in Provider ID catalog or the custom endpoint as editable rows, retaining gateway settings and existing edits. Expand rows to edit capacities or delete models before saving; empty custom model lists remain empty. Start the provider list empty and show only saved providers. Remember model selections for new conversations and preserve readable history when providers are removed.
- coding-agent: expose provider catalog/runtime configuration and optional restoration of history with an unavailable model, while keeping prompt authentication checks.
- Web UI and coding-agent: configure the model and supported reasoning effort from a popover beside Send, listing only saved providers' models under their display names, with search, keyboard controls, session persistence and remembered defaults. Custom models offer effort directly without a capability checkbox; Default sends no explicit reasoning settings.
- Web UI, coding-agent and Agent: send image attachments from the composer using the picker or paste, preview/remove them, preserve them in session history and retain exact images on uncertain delivery. Provider forms no longer require image/reasoning capability switches.

### Changed

- Web UI: simplify the conversation header to a folder icon and session name with tighter spacing and a background matching the conversation. Highlight the name on hover and edit it inline with Enter to save and Escape or blur to cancel, synchronizing the header and sidebar. Remove the project path and separate rename/regenerate buttons.
- Web UI: remove the model selector from the session header and place it in the input box.
- Web UI: replace the sidebar language selector with a Settings button, add hover feedback, and reduce its bottom spacing.
- Agent and coding-agent: use generic gateway, model, and credential placeholders in usage samples.
- Web UI: move the standalone model configuration entry into Settings → Models. Migrate legacy provider configuration on the next save; model menus show only configured providers. See [provider migration](src/web-ui/backend/docs/providers.md#storage-and-migration).

### Fixed

- Web UI: correct the composer model menu chevron to point down when closed and up when open.
- Web UI and coding-agent: retain Pi AI thinking-level mappings for matching custom provider models, exposing supported Extra high and Maximum efforts and passing their mapped values to the configured gateway without changing connection settings.
- Web UI: keep custom provider dialogs within the viewport with only the model list scrolling; connection fields, headers and actions remain fixed while fetching or expanding models.
- Web UI: translate Settings titles, navigation, headings, and descriptions when switching languages. Refresh translations during development hot updates so new strings do not appear as raw keys.

### Removed

- Web UI: remove session tabs, their open/close state and cached titles. Switch conversations through the project sidebar; remember only the selected session across reloads. Preserve drafts, attachments during session switches, saved history and background runs.
