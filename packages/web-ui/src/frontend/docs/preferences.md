# Interface Preferences

The browser stores layout, language, theme, and unsent drafts. The backend stores project registration, provider credentials, the default permission for new Web sessions, session pins, read receipts, and complete session history.

## Layout and Language

The desktop sidebar defaults to 260px and can be resized between 260px and 420px by dragging its divider or using the left/right arrow keys while the divider has focus. Narrow screens use a drawer. A closed drawer is not keyboard-accessible; an open drawer supports Escape to close and Tab focus cycling.

The sidebar uses a translucent frosted-glass background with backdrop blur, a soft highlight and a subtle edge in Light and Dark themes. Text and controls stay sharp. Background content is blurred where the mobile drawer overlaps the conversation; the desktop tint is subtler over the plain app background. Browsers without backdrop-filter support, or with reduced transparency enabled, use an opaque background.

The sidebar shows the electric-blue Loop icon at 28px; the welcome screen shows it at 64px. Both use the shared [LoopIcon](../components/ui/LoopIcon.tsx) and supplied 256px PNGs to preserve the smooth gradient on high-density displays. Light uses the approved charcoal tile with a white-to-blue mark; Dark uses a white tile with a charcoal-to-blue mark. Geometry, spacing and the blue endpoint stay the same. Explicit Light/Dark selections override the browser preference, while System follows live `prefers-color-scheme` changes through CSS. The images update without remounting or changing layout. These decorative images are hidden from assistive technology; nearby text provides the context. Browser favicons and Safari icons keep the standard [brand assets](../../docs/assets/loop-brand/README.md), independently of the in-app theme setting.

Open **Settings** at the bottom of the sidebar, then use the language dropdown in **General**. The modal's left navigation groups **General**, **Models** and **Appearance** under **Personal** (**个人** in Chinese), followed by **Integrations → MCPs and Skills** for [MCP settings](integrations.md), and a separate **Archived** (**归档**) section containing **Archived chats**. Regular-weight gray labels align with the item icons. Each opening starts on General; use Tab to move between navigation groups and Up/Down or Home/End within each group. Use **Models** to manage providers and credentials. The sidebar entry, dialog title, navigation, page headings, and option descriptions all follow the selected interface language.

Hovering over Settings highlights a 40px-high row with 12px corners and narrow 8px side insets. A translucent tint darkens the background in Light mode and lightens it in Dark mode while retaining the sidebar's glass effect. The row sits 8px below the divider and above the bottom edge. The brief color transition respects reduced-motion preferences.

The General panel starts with a General page heading and a General section heading. Rounded settings cards contain Permission followed by Language, each with a short description and dropdown. Permission selects Read only, Workspace write, or Full access for future Web sessions across all projects; existing sessions keep their saved permissions. Full access requires confirmation. The backend persists this preference independently of browser language and theme; see [permissions](permissions.md). In Chinese the headings read 通用, and the Language description reads 应用界面使用的语言.

**Archived → Archived chats** displays directly inside Settings, replacing the General → Manage dialog. All Settings sections share the same dialog width: up to 960px on desktop, adapting to the viewport on narrow screens. Switching sections, including MCPs, Skills and configuration forms, keeps the dialog size, position and navigation width stable. Chats are grouped by project with timestamps, counts, filters, Unarchive and confirmed delete actions. No search input is displayed. Open a chat to view it and close Settings. See [project actions](projects.md) for archive and removal behavior.

The dropdown supports **中文** and **English**, with a checkmark on the selected language. With no valid saved choice, initialization uses the first supported entry in the browser's language list, matching Chinese and English regional variants; if none match, it uses English. When the list is unavailable or empty, it uses the browser's single language value. Automatic matching does not save a preference. A manual selection is saved immediately and takes priority on later visits. Browser language changes are picked up on the next page load only when no manual choice exists.

Switching updates interface text and the page lang attribute without refreshing or interrupting generation. Model messages, tool output, and user input remain unchanged. History dates use the current language; saved conversation titles remain unchanged.

During development, Vite hot updates of the English or Chinese resource file refresh i18next's resource store and the visible translations without changing the selected language or reloading the page.

Open the dropdown with click, Enter, Space, or an arrow key. Use arrow keys or Home/End to navigate and Enter/Space to select. Escape closes the dropdown first; clicking outside or tabbing away also dismisses it. The modal closes with its top-right button or Escape and returns focus to Settings. On mobile, closing Settings leaves the project drawer open.

## Appearance

Interface text uses a 13px base. Sidebar project names, session names and Settings use 13px, with 12px group labels and secondary text. Chat titles, messages and desktop input use 14px; settings and dialog headings use 18px. Markdown headings step from 22px to 12px. Mobile composer text remains 16px. Font families, weights, colors, icons and spacing are unchanged.

The Appearance panel displays its page heading above the Theme section.

In **Settings → Appearance**, the **Theme** section offers preview cards ordered **System**, **Light**, **Dark**. System uses a split light/dark preview; the selected card has an emphasized border and label. Cards are shown side by side on desktop and stacked when the content area is narrow. System is selected by default and follows the browser's preferred color scheme, including changes while the page is open. Light or Dark overrides that preference until System is selected again. Selecting a card applies immediately, persists across reloads and section switches, and does not reload the page or affect conversations and drafts. The radio group supports Tab, arrow keys, and Space.

The theme applies to the entire interface: sidebar, settings and project dialogs, conversation surfaces, inputs, menus, Markdown, and code highlighting. Native controls use the same color scheme. Saved theme preferences are applied before React renders. Missing, invalid, or unreadable values use System; unavailable storage does not prevent switching for the current page.

Theme colors use CSS `light-dark()` with `color-scheme`, requiring a modern browser (Chrome/Edge 123+, Firefox 120+, Safari 17.5+). Browser-managed System mode needs no JavaScript event listener.

## Local State

All persistent browser keys use the `loop.web.` prefix and belong to the browser origin. Different ports or browsers do not share these browser preferences. The Permission default, session pins and read receipts are stored on the server and are shared by browsers using the same Loop server.

| State | Storage and restoration |
| --- | --- |
| language | Restore a manually selected `en` or `zh`; missing, corrupt, or unsupported values use browser language matching |
| theme | Restore `light`, `dark`, or `system`; default to `system` |
| sidebarWidth | Restore a sidebar width within the allowed range |
| activeSession | Restore the selected session ID and its project ID; no title or open-session list is stored |
| expanded | Restore project expansion |
| drafts, draftProjects | Store unsent text and its project by session; retained when switching sessions |
| requests | Store unconfirmed text, images, requestId and streamId for manual retry |
| Unsent images | Memory only per session; retained across session switches, discarded on refresh |
| Session display snapshots | Memory only; reload from the backend after refresh |

Pins are optional pinnedAt timestamps in the session header and are shared across browsers using the same server; the UI derives pin state and order from project summaries, with no browser pin cache.

Unread is a boolean in the server's session header. The page renders that flag directly from session snapshots or list summaries. A read request carries the displayed message count to guard against stale requests; there is no read-position cache, separate receipt file or browser persistence. See [unread indicators](projects.md).

Existing drafts and unconfirmed requests are retained; select their session from the sidebar to continue. The drawer's open/closed state is temporary. Unavailable browser storage or failed writes do not interrupt chat, but the affected state cannot persist.

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
