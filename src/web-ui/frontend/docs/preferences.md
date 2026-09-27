# Interface Preferences

The browser stores layout, language, theme, and unsent drafts. The backend stores project registration, provider credentials, and complete session history.

## Layout and Language

The desktop sidebar defaults to 260px and can be resized between 260px and 420px by dragging its divider or using the left/right arrow keys while the divider has focus. Narrow screens use a drawer. A closed drawer is not keyboard-accessible; an open drawer supports Escape to close and Tab focus cycling.

Open **Settings** at the bottom of the sidebar, then use the language dropdown in **General**. The modal's left navigation contains **General** followed by **Appearance**. Each opening starts on General; click a section or use Up/Down and Home/End while a navigation item has focus to switch panels. The separate **Model settings** entry still configures providers. The sidebar entry, dialog title, navigation, page headings, and option descriptions all follow the selected interface language.

Hovering over Settings highlights the full rounded button, using a darker background in Light mode and a lighter background in Dark mode. The brief color transition respects reduced-motion preferences.

The General panel starts with a General page heading and a General section heading. A rounded settings card contains Language, a short description, and its dropdown. In Chinese these headings read 通用, and the description reads 应用界面使用的语言.

The dropdown supports **中文** and **English**, with a checkmark on the selected language. With no valid saved choice, initialization uses the first supported entry in the browser's language list, matching Chinese and English regional variants; if none match, it uses English. When the list is unavailable or empty, it uses the browser's single language value. Automatic matching does not save a preference. A manual selection is saved immediately and takes priority on later visits. Browser language changes are picked up on the next page load only when no manual choice exists.

Switching updates interface text and the page lang attribute without refreshing or interrupting generation. Model messages, tool output, and user input remain unchanged. History dates use the current language; open tabs retain the title assigned when opened.

During development, Bun hot updates of the English or Chinese resource file refresh i18next's resource store and the visible translations without changing the selected language or reloading the page.

Open the dropdown with click, Enter, Space, or an arrow key. Use arrow keys or Home/End to navigate and Enter/Space to select. Escape closes the dropdown first; clicking outside or tabbing away also dismisses it. The modal closes with its top-right button or Escape and returns focus to Settings. On mobile, closing Settings leaves the project drawer open.

## Appearance

The Appearance panel displays its page heading above the Theme section.

In **Settings → Appearance**, the **Theme** section offers preview cards ordered **System**, **Light**, **Dark**. System uses a split light/dark preview; the selected card has an emphasized border and label. Cards are shown side by side on desktop and stacked when the content area is narrow. System is selected by default and follows the browser's preferred color scheme, including changes while the page is open. Light or Dark overrides that preference until System is selected again. Selecting a card applies immediately, persists across reloads and section switches, and does not reload the page or affect conversations and drafts. The radio group supports Tab, arrow keys, and Space.

The theme applies to the entire interface: sidebar, settings and project dialogs, conversation surfaces, inputs, menus, Markdown, and code highlighting. Native controls use the same color scheme. Saved theme preferences are applied before React renders. Missing, invalid, or unreadable values use System; unavailable storage does not prevent switching for the current page.

Theme colors use CSS `light-dark()` with `color-scheme`, requiring a modern browser (Chrome/Edge 123+, Firefox 120+, Safari 17.5+). Browser-managed System mode needs no JavaScript event listener.

## Local State

All persistent keys use the `loop.web.` prefix and belong to the browser origin. Different ports or browsers do not share these preferences.

| State | Storage and restoration |
| --- | --- |
| language | Restore a manually selected `en` or `zh`; missing, corrupt, or unsupported values use browser language matching |
| theme | Restore `light`, `dark`, or `system`; default to `system` |
| sidebarWidth | Restore a sidebar width within the allowed range |
| tabs, expanded | Restore open tabs and project expansion |
| drafts, draftProjects | Store unsent text and its project by session; retained when closing tabs |
| requests | Store unconfirmed text, requestId, and streamId for manual retry |
| Session display snapshots | Memory only; reload from the backend after refresh |

The active tab is not stored separately: refresh starts with the first saved tab. The drawer's open/closed state is also temporary. Unavailable browser storage or failed writes do not interrupt chat, but the affected state cannot persist.

## Limits

Drafts and unconfirmed requests contain user input in local browser storage; they are not a backup of session history. There is no cross-device synchronization, custom color palette editor, or browser-storage management UI. API keys are not stored in these preferences; see [model settings](models.md).

## Source and Tests

- [AppShell](../components/layout/AppShell.tsx) / [tests](../components/layout/AppShell.test.tsx).
- [useSidebarWidth](../hooks/useSidebarWidth.ts) / [tests](../hooks/useSidebarWidth.test.ts).
- [useMobileDrawer](../hooks/useMobileDrawer.ts) / [tests](../hooks/useMobileDrawer.test.tsx).
- [Language initialization](../i18n/setup.ts) / [translation contract tests](../i18n/setup.test.ts).
- [Language matching](../i18n/language.ts) / [tests](../i18n/language.test.ts).
- [Settings dialog](../components/settings/SettingsDialog.tsx) / [tests](../components/settings/SettingsDialog.test.tsx).
- [Language dropdown](../components/settings/LanguageSelect.tsx) / [tests](../components/settings/LanguageSelect.test.tsx).
- [preferences](../lib/preferences.ts) / [tests](../lib/preferences.test.ts).
- [Appearance cards](../components/settings/AppearanceSettings.tsx) / [tests](../components/settings/AppearanceSettings.test.tsx).
- [Theme preferences](../state/theme-store.ts) / [tests](../state/theme-store.test.ts) / [theme colors](../theme.css).
