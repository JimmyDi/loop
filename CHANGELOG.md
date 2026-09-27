# Changelog

Notable changes across Agent, coding-agent, and Web UI are recorded here. Pending changes accumulate under Unreleased; release preparation groups them by version and date. See [Contributing](CONTRIBUTING.md#changelog) for the maintenance workflow.

## [Unreleased]

### Added

- Web UI: add a Settings dialog with separate General and Appearance tabs, keyboard navigation, and focus restoration. Keep model configuration available through its existing entry.
- Web UI: initialize the interface language from the browser's supported languages and remember manual Chinese or English selections without reloading or interrupting conversations.
- Web UI: add System, Light, and Dark theme previews and persist the selected theme across visits. System follows browser color-scheme changes. Theme styling requires Chrome/Edge 123+, Firefox 120+, or Safari 17.5+.

### Changed

- Web UI: replace the sidebar language selector with a Settings button, add hover feedback, and reduce its bottom spacing.
- Agent and coding-agent: use generic gateway, model, and credential placeholders in usage samples.

### Fixed

- Web UI: translate Settings titles, navigation, headings, and descriptions when switching languages. Refresh translations during development hot updates so new strings do not appear as raw keys.
