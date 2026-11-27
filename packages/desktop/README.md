# Loop Desktop

Tauri 2 application for macOS Apple Silicon, Intel macOS, and Windows x64. The private desktop package includes Node 24, the Web frontend, and the Web backend. Desktop versions follow the root package version.

## Operating systems and processors

| Operating system | Processor architecture | Installer |
| --- | --- | --- |
| macOS 14 Sonoma, macOS 15 Sequoia, macOS 26 Tahoe | Apple Silicon ARM64 (M series) | DMG |
| macOS 14 Sonoma, macOS 15 Sequoia, macOS 26 Tahoe on compatible Intel Macs | Intel x86_64 | DMG |
| Windows 10, Windows 11 (64-bit) | Intel or AMD x86_64 | EXE (NSIS) |

The configured macOS deployment minimum is 14.0. Windows requires Microsoft Edge WebView2 Runtime, handled by the Tauri installer. Each Mac must support its installed macOS version.

These are the desktop distribution targets. Local builds have been checked on Apple Silicon; the CI matrix builds on macOS 15 ARM64, macOS 15 Intel and Windows Server 2022 x64. Installation and runtime validation on each listed operating system remain pending. Windows Server is a CI build host here.

Desktop installers currently cover these two macOS architectures and Windows x64. Linux, Windows ARM64, 32-bit Windows, iOS and Android are outside the current desktop distribution targets.

## Development

Install Node 24+, pnpm, Rust 1.90+ and the platform prerequisites for Tauri 2. Run `pnpm install --frozen-lockfile` and `pnpm desktop:dev` from the workspace root. Run `pnpm desktop:build` to prepare packaged resources for smoke tests, or `pnpm --filter @loop/desktop bundle` to build a local installer.

Resources are written to this package's dist directory. Installers are written to src-tauri/target/release/bundle. The root npm build selects its workspace dependencies explicitly and excludes desktop resources and dependencies.

Desktop generates only the PNG, ICNS, and ICO files listed in its Tauri config from assets/icon.png when they are missing or older than the source. The source uses the white-background Loop artwork. Its 1024-pixel transparent canvas contains centered 824-pixel artwork with 100-pixel margins for balanced Dock sizing.

The desktop:dev command runs the backend source with the same Node installation as pnpm and serves the local frontend source through Vite with React Fast Refresh and CSS hot updates. It builds the Web static frontend at startup for phone access. To refresh those static assets after editing the frontend, run `pnpm --filter @loop/web-ui build:frontend` from the workspace root. Desktop update-control source also supports hot updates. Changes to backend, shared protocol or core source restart the development backend and reload the window. Backend restarts stop running tasks. Rust edits use Tauri's native recompilation and restart. Development updates are disabled.

Frontend and application-backend edits keep the native window open. Restart desktop:dev after editing the desktop development launcher, supervisor or gateway. Tauri watches the native Rust project. Resource builds write Cargo version files only when the version changes.

## Runtime

The sidebar Settings button opens a menu with Settings and Feedback. Settings opens a centered modal dialog with category navigation and a close button. Escape dismisses it and returns focus to its trigger. Conversation and sidebar state persist underneath. Feedback opens its link from the sidebar menu.

The session-list toggle sits at the panel's top-right corner when expanded and moves beside the macOS window controls on a circular background when collapsed. It follows the panel width when resized. During dragging, the panel edge, content and button follow the pointer immediately with a transparent resize target. The button position and list width and opacity animate during collapse and expansion. Collapsing hides both navigation and the session list, including the panel background, and expands the conversation into their space. Hidden controls leave keyboard navigation, and reduced-motion preferences disable the transitions.

The macOS window uses a transparent native frame clipped to a 28-point corner radius, with a 20-pixel inner panel radius and 8-pixel inset. AppKit retains the window shadow and traffic-light controls. Fullscreen uses square outer corners. This enables Tauri's macOS private transparency API and requires rebuilding and restarting the native app.

Wide-screen layout and surface styles are shared with the Web frontend. The 52-pixel macOS title bar aligns the window controls and panel toggle. The Loop heading labels the sidebar and Settings sits at its bottom. Sidebar rows use aligned insets and compact pagination controls. The message column and composer share an 860-pixel maximum width and 24-pixel side insets. On macOS, the session heading occupies the overlay title bar and supports inline renaming. The header uses an opaque workspace-colored backing, fading into messages below it across a 68-pixel overlay. Light mode uses a white workspace and composer with a near-white sidebar panel, a plain white border. Surrounding gaps share the workspace base color. Dark mode uses coordinated neutral grays. Reduced-transparency preferences use an opaque header and disable the fade transition. Header space supports window dragging, with reserved space for native window controls. The desktop grants dragging permission only to its own loopback origin.

The shell starts the packaged Node executable, waits for readiness, and opens the existing Web UI through a loopback gateway. A per-launch HttpOnly cookie authenticates the desktop window. The backend requires an additional per-launch secret. Remote access retains its existing device authorization.

The macOS Dock icon shows the unread count across unarchived chats in local projects and outside projects while Loop runs. The count follows session updates and clears when no unread chats remain.

The macOS message scrollbar starts below the 68-pixel title-bar fade. Its narrow thumb uses theme-aware colors and an inset from the window edge, keeping the full thumb visible and available for dragging.

Desktop uses the same data-root resolution as Web and CLI. LOOP_DATA_DIR overrides the default ~/.loop directory. Existing provider configuration, projects, settings and saved sessions are available through the shared backend contracts. The desktop-specific loopback port and window state live in the platform application-data directory. A persisted loopback port preserves desktop browser preferences, selected sessions and text drafts across restarts. Port conflicts fail startup. Image attachments held only in frontend memory should be sent before restarting.

Browser local storage is specific to each browser or desktop window. Running processes keep their own in-memory sessions and provider configuration. Restart Desktop after changing provider configuration through a separate Web process.

The desktop shares the core platform capabilities. Windows confined shell execution reports SANDBOX_UNAVAILABLE. Host Bash commands require an available Bash installation and the existing explicit permission flow. Windows task-tree cancellation requires platform validation.

## Updates

The Rust updater checks in the background at startup and every four hours. An update icon button appears to the right of Settings for downloads, installation, task stopping and errors. Its tooltip and accessible label report the current state, version and download progress. Clicking a ready update asks to stop running tasks before installation and restart. Clicking an error shows its details. After downloading and signature verification, an idle application saves sessions and restarts into the installed update. Running sessions, tool execution, user questions and approvals postpone installation. The user can stop tasks through the update button. Natural completion also permits updating. New local and remote business requests are excluded while the backend prepares for installation.

Both development and packaged builds display the icon only after an update is detected. Idle, checking, up-to-date and unconfigured states keep it hidden. Connection or check failures alone keep it hidden. Errors for an already detected update remain accessible through the icon.

The update service uses a dedicated desktop-stable GitHub Release containing stable.json. Versioned desktop-vX.Y.Z releases contain installers, update bundles and signatures. The stable manifest is uploaded after all platform artifacts are published and verified reachable. A matching npm version is required. Releases can resume a draft from the same source commit. Published versions remain immutable and the stable channel rejects version downgrades.

Unconfigured builds keep the update button hidden. Production configuration requires LOOP_UPDATER_URL and LOOP_UPDATER_PUBLIC_KEY at build time. The URL must use HTTPS. The updater validates downloads with the embedded public key.

## CI configuration

Manually dispatch Desktop to build unsigned test installers for all three targets. Download the artifacts from the workflow run. These builds use macOS ad-hoc signing and Windows unsigned executables, with automatic updates disabled. Test installers can be distributed through a separately labeled GitHub prerelease.

Push a vX.Y.Z tag to run the Release workflow. Its existing main-branch ancestry, version, changelog and verification checks apply to both npm and desktop releases. After npm publication and the application GitHub Release succeed, Release calls the reusable Desktop workflow to build installers for all three targets from the same commit and publish the desktop update. Tag releases currently use macOS ad-hoc signing and unsigned Windows executables. Operating systems may display security prompts. Update artifacts are signed with the Tauri key, and automatic updates are enabled. A failed desktop job can be rerun from that Release run. To recover after a workflow fix has merged, manually dispatch Desktop on main with publish_release enabled. This builds the current package version, requires main ancestry and its existing npm publication, and publishes the desktop update channel. Configure these repository values before the first release.

- Repository variable LOOP_UPDATER_PUBLIC_KEY contains the Tauri update verification key.
- Secrets TAURI_SIGNING_PRIVATE_KEY and optional TAURI_SIGNING_PRIVATE_KEY_PASSWORD sign update artifacts.

Optional platform certificate signing is available through pnpm bundle:release by omitting --no-platform-signing and restoring the certificate environment variables in the workflow. It requires the following configuration.

- macOS uses APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD and APPLE_TEAM_ID for Developer ID signing and notarization.
- Windows uses WINDOWS_CERTIFICATE and WINDOWS_CERTIFICATE_PASSWORD for a CI-importable Authenticode certificate.

Keep signing material outside the repository. Preserve the update signing key across releases. Certificate-free tag releases require the Tauri update key and public key. The earlier manually dispatched test installers have automatic updates disabled and require a manual installation to move to an update-enabled release.

## Verification

Run pnpm typecheck, pnpm check, and pnpm exec vitest run packages/desktop packages/web-ui/src/backend/server-maintenance.test.ts. After pnpm desktop:build, run pnpm exec tsx packages/desktop/scripts/smoke.ts.

Run cargo test --locked from src-tauri after building resources. The native test launches the packaged backend and exercises maintenance and shutdown. Native installer execution and signed upgrades need each target operating system and valid signing configuration. Installation failures are reported after restarting the existing app when the platform installer permits recovery.

After bundling, run pnpm exec tsx packages/desktop/scripts/app-smoke.ts from the repository root. CI runs this check on all three targets to exercise native plugin initialization, packaged resource discovery, backend startup and clean shutdown.
