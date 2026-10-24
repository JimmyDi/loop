# Mobile Layout and Installed App

Loop can be installed from a production build on a secure origin. It keeps the same remote pairing and permission checks as the browser. Installation provides a home-screen entry and a standalone window; the computer, Loop process and tunnel must remain available for chats.

## Usage

1. Build with pnpm build, start Loop and connect the private tunnel in **Settings → Remote access**.
2. Pair the phone in its browser and approve it on the computer.
3. Choose **Install Loop** when offered. Otherwise choose **Add to home screen** for instructions. On iPhone or iPad, open in Safari, choose Share, then Add to Home Screen. On Android, use Install app or Add to home screen in the browser menu.
4. Open the home-screen entry. If its storage is separate, use a fresh invitation and approve pairing there.

Installation is optional. Dismiss hides the hint for the current page. Browser policy determines whether a native install prompt is available. Embedded browsers can require opening Safari or Chrome first.

## Mobile Controls

The sidebar becomes a drawer below 768px. Opening it moves focus inside and makes the conversation inert; Tab stays within its controls, Escape and the scrim close it. Returning to a desktop width restores access to the conversation.

Header, sidebar and composer account for safe-area insets. Primary chat and approval controls use at least 44px touch heights. Permission and model menus remain scrollable, and approvals have a bounded scrolling area above the composer. The toolbar wraps when both Stop and Send are available.

On devices with a coarse primary pointer, Enter inserts a newline. Tap Send to submit, or use Ctrl/Command+Enter on an attached keyboard. IME composition never submits. Opening or switching chats does not automatically open the touch keyboard. The existing visual-viewport adjustment keeps bottom-aligned messages above the composer when the keyboard appears.

## Cache and Offline Behavior

The build produces /manifest.webmanifest, /sw.js, /offline.html and 192px/512px PNG icons. Public icons, including the light/dark loading logos, are served directly at the origin root in development and production. The manifest starts at / without invitation codes or credentials. Its link includes credentials for private tunnel access. Registration occurs only in a production build in a secure context; remote pairing remains a separate lightweight bootstrap.

The service worker precaches only the generic offline page, manifest and installation icons. An exact build-generated allowlist permits caching successful JavaScript, CSS, image and font downloads. Query-bearing requests, cross-origin requests, non-GET requests, APIs, authorization endpoints, errors, redirects and HTML returned for scripts are excluded. Conversation HTML, API responses, SSE, invitations and authentication material are never written to this cache. Existing browser draft preferences retain their previous behavior.

Navigations always use the network. On devtunnels.ms subdomains, the worker leaves document navigation entirely to the browser, including refreshes and Microsoft sign-in redirects. It does not call respondWith or fetch for these navigations, preserving the native navigation and cookie context. Static caching remains available. On other origins, a network failure returns a generic themed offline page with Retry; private tunnel navigation uses the browser's network error page instead. Neither path displays cached chats or accepts offline commands. HTTP authentication failures retain their real response. The in-app offline message reflects the browser connectivity signal, which does not prove the computer or tunnel is reachable.

## Updates and Limits

Frontend builds publish staged assets before atomically replacing HTML entries and publishing the worker last. Failed builds leave the previous frontend available, and old hashed resources remain readable by open tabs until the output is explicitly cleaned while stopped. Rebuild the remote frontend with pnpm --filter @loop/web-ui build:frontend; pnpm dev alone does not publish it.

A downloaded update shows **Reload to update** and **Later**. Finish unsent input or approval before choosing reload. The worker does not force-reload an existing chat; only an explicit update action requests activation and reloads that page. The browser checks for updates on registration, when the page becomes visible and when it goes online. Failed registration or update checks leave normal browser use available.

Installation is tied to the exact public hostname. If a new tunnel has a different address, add a new home-screen entry and pair again. Installation cannot keep the computer awake, bypass tunnel sign-in or preserve a connection while the computer sleeps. Background streaming and network-recovery improvements are separate work.

## Source and Tests

- [Build plugin](../../../pwa-plugin.ts) / [tests](../../../pwa-plugin.test.ts).
- [Service worker](../pwa/service-worker.ts) / [tests](../pwa/service-worker.test.ts).
- [Browser lifecycle](../pwa/pwa-client.ts) / [tests](../pwa/pwa-client.test.ts).
- [Installation and update status](../components/pwa/PwaStatus.tsx) / [tests](../components/pwa/PwaStatus.test.tsx).
- [Remote pairing](remote-access.md), [chat input](chat.md), [approvals](permissions.md).
