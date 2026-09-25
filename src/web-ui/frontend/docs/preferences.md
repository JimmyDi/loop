# Interface Preferences

The browser stores layout, language, and unsent drafts. The backend stores project registration, provider credentials, and complete session history.

## Layout and Language

The desktop sidebar defaults to 260px and can be resized between 260px and 420px by dragging its divider or using the left/right arrow keys while the divider has focus. Narrow screens use a drawer. A closed drawer is not keyboard-accessible; an open drawer supports Escape to close and Tab focus cycling.

The sidebar language menu supports English and Chinese, defaulting to English on first use. Switching updates interface text and the page lang attribute without refreshing or interrupting generation. Model messages, tool output, and user input remain unchanged. History dates use the current language; open tabs retain the title assigned when opened.

## Local State

All persistent keys use the `loop.web.` prefix and belong to the browser origin. Different ports or browsers do not share these preferences.

| State | Storage and restoration |
| --- | --- |
| language, sidebarWidth | Restore language and a sidebar width within the allowed range |
| tabs, expanded | Restore open tabs and project expansion |
| drafts, draftProjects | Store unsent text and its project by session; retained when closing tabs |
| requests | Store unconfirmed text, requestId, and streamId for manual retry |
| Session display snapshots | Memory only; reload from the backend after refresh |

The active tab is not stored separately: refresh starts with the first saved tab. The drawer's open/closed state is also temporary. Unavailable browser storage or failed writes do not interrupt chat, but the affected state cannot persist.

## Limits

Drafts and unconfirmed requests contain user input in local browser storage; they are not a backup of session history. There is no cross-device synchronization, theme editor, or browser-storage management UI. API keys are not stored in these preferences; see [model settings](models.md).

## Source and Tests

- [AppShell](../components/layout/AppShell.tsx) / [tests](../components/layout/AppShell.test.tsx).
- [useSidebarWidth](../hooks/useSidebarWidth.ts) / [tests](../hooks/useSidebarWidth.test.ts).
- [useMobileDrawer](../hooks/useMobileDrawer.ts) / [tests](../hooks/useMobileDrawer.test.tsx).
- [Language initialization](../i18n/setup.ts) / [translation contract tests](../i18n/setup.test.ts).
- [preferences](../lib/preferences.ts) / [tests](../lib/preferences.test.ts).
