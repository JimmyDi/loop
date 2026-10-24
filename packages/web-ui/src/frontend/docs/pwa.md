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

Below 768px, session rows hide the inline pin button. Pinning and unpinning remain available in the session context menu.

Header, sidebar and composer account for safe-area insets. Primary chat and approval controls use at least 44px touch heights. Permission and model menus remain scrollable, and approvals have a bounded scrolling area above the composer. The toolbar wraps when both Stop and Send are available.

On devices with a coarse primary pointer, Enter inserts a newline. Tap Send to submit, or use Ctrl/Command+Enter on an attached keyboard. IME composition never submits. Opening or switching chats does not automatically open the touch keyboard. The existing visual-viewport adjustment keeps bottom-aligned messages above the composer when the keyboard appears.

## Cache and Offline Behavior

The shared theme suppresses the browser's transient tap-highlight overlay on touch screens, including the pairing page. Interface labels, navigation, session lists, menus and action controls do not support long-press text selection or native touch callouts on controls. Message bodies, code, file contents, error details and text inputs remain selectable. Keyboard focus indicators, scrolling and component interaction states remain available.

The build produces /manifest.webmanifest, /sw.js, /offline.html and 192px/512px PNG icons. Public icons, including the light/dark loading logos, are served directly at the origin root in development and production. The manifest starts at / without invitation codes or credentials. Its link includes credentials for private tunnel access. Registration occurs only in a production build in a secure context; remote pairing remains a separate lightweight bootstrap.

The service worker precaches only the generic offline page, manifest and installation icons. An exact build-generated allowlist permits caching successful JavaScript, CSS, image and font downloads. Query-bearing requests, cross-origin requests, non-GET requests, APIs, authorization endpoints, errors, redirects and HTML returned for scripts are excluded. Conversation HTML, API responses, SSE, invitations and authentication material are never written to this cache. Existing browser draft preferences retain their previous behavior.

Navigations always use the network. On devtunnels.ms subdomains, the worker leaves document navigation entirely to the browser, including refreshes and Microsoft sign-in redirects. It does not call respondWith or fetch for these navigations, preserving the native navigation and cookie context. Static caching remains available. On other origins, a network failure, HTTP 503 or a navigation that has not returned headers within 15 seconds returns a generic themed offline page with Retry; timed-out downloads are aborted. Private tunnel navigation uses the browser's network error page instead. Neither path displays cached chats or accepts offline commands. HTTP authentication failures retain their real response. The in-app offline message reflects the browser connectivity signal, which does not prove the computer or tunnel is reachable.

## Updates and Limits

Frontend builds publish staged assets before atomically replacing HTML entries and publishing the worker last. Failed builds leave the previous frontend available, and old hashed resources remain readable by open tabs until the output is explicitly cleaned while stopped. Rebuild the remote frontend with pnpm --filter @loop/web-ui build:frontend; pnpm dev alone does not publish it.

A downloaded update shows **Reload to update** and **Later**. Finish unsent input or approval before choosing reload. The worker does not force-reload an existing chat; only an explicit update action requests activation and reloads that page. The browser checks for updates on registration, when the page becomes visible and when it goes online. Failed registration or update checks leave normal browser use available.

Explicit updates reload at most once even if the worker emits repeated activation events. If activation does not respond within two seconds, or posting the activation message fails, the page reloads anyway. If the old document still runs 250 milliseconds after requesting reload, it replaces the current entry with the root URL as a recovery attempt. This fallback neither clears device authorization nor guarantees completion of an external sign-in flow.

Installation is tied to the exact public hostname. If a new tunnel has a different address, add a new home-screen entry and pair again. Installation cannot keep the computer awake, bypass tunnel sign-in or preserve a connection while the computer sleeps. Foreground and network recovery use the shared [stream lifecycle](events.md). Transient authorization-check network/5xx failures preserve already-loaded chats with a retry notice; explicit denial, expiry or revocation clears access and cached session state. First authorization still fails closed. Background streaming and notifications are not provided.

## Device Verification

Remote startup bounds authorization checks, including body reads, to 10 seconds and chat downloads to 30 seconds. Failures expose Retry; module-load failures reload the root URL so the browser can request current entry assets. The HTML loading placeholder also exposes a root-page retry after 35 seconds if startup scripts have not replaced it. This recovery does not clear device cookies, unregister the worker or automatically repeat pairing commands.

Use a production frontend build and an approved device. These checks require real Android/iOS browsers and the deployed tunnel; automated tests do not establish carrier, regional connectivity or Microsoft sign-in behavior.

1. Start a response, background the browser, then return: the stream catches up without a new prompt.
2. Disable the phone network: offline status appears and sending is disabled. Restore connectivity or switch Wi-Fi/mobile data: messages and lists synchronize without replaying commands.
3. Interrupt connectivity after sending but before acceptance: the request stays recoverable. Check and retry confirms acceptance or reuses its ID within the same server stream.
4. Restart the backend between confirmation and submission: the obsolete stream is rejected; inspect history before manually sending anew.
5. Sleep and wake the computer: it is unreachable while asleep; the page catches up after network/tunnel recovery.
6. Revoke the device from the desktop: streams end and private chat data is removed. Pair again to reconnect.

## Source and Tests

- [Build plugin](../../../pwa-plugin.ts) / [tests](../../../pwa-plugin.test.ts).
- [Service worker](../pwa/service-worker.ts) / [tests](../pwa/service-worker.test.ts).
- [Browser lifecycle](../pwa/pwa-client.ts) / [tests](../pwa/pwa-client.test.ts).
- [Installation and update status](../components/pwa/PwaStatus.tsx) / [tests](../components/pwa/PwaStatus.test.tsx).
- [Remote pairing](remote-access.md), [chat input](chat.md), [approvals](permissions.md).
