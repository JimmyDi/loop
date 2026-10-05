# Development and distribution

## Setup

Loop requires Node.js 24+ and pnpm 11. Install workspace dependencies from the repository root:

```bash
pnpm install
pnpm dev
```

The browser opens when the local service is ready. Configure a provider in Settings → Models before creating a conversation. Development uses Vite middleware for frontend HMR and Node watch mode for backend changes, on the same loopback port.

For the terminal, configure the environment described in [models](../packages/coding-agent/src/docs/models.md), then run pnpm coding-agent. The application entry loads the working directory's .env; inherited environment variables take precedence. SDK imports do not load environment files.

## Build and launch

```bash
pnpm build
node dist/bin.js web
node dist/bin.js web --port 3081 --no-open
node dist/bin.js --help
```

Production serves prebuilt Web assets from the installed package, independently of the working directory. Vite and Bun are not runtime requirements. The server binds to loopback only; browser opening is suppressed over SSH and with --no-open.

## Packages

Three private packages own Agent, coding-agent and Web. The public root distribution is named `@loop-harness/loop`. Installed SDK consumers import `@loop-harness/loop`; workspace consumers import @loop/agent or @loop/coding-agent. Public exports resolve to build output; development uses the loop-source export condition.

Web and terminal/SDK entries consume coding-agent; coding-agent consumes agent; agent calls the model API through its injected stream function. The model-runtime module configures the model runtime and injects its stream function; the agent loop initiates requests. Browser/shared modules may consume coding-agent types but cannot import its runtime. SDK imports do not load terminal or Web implementations.

## Validation

Run pnpm typecheck, pnpm check and pnpm build. Run affected tests with pnpm exec vitest run followed by their file paths. Build before tests that launch the compiled application. Model tests use synthetic local responses. Confined shell tests require macOS Seatbelt or Linux Bubblewrap.

Linux CI installs Bubblewrap and, when Ubuntu restricts unprivileged user namespaces, loads an AppArmor profile permitting them specifically for /usr/bin/bwrap on the disposable runner. A sandbox startup probe must pass before running the suite. Network isolation and capability dropping remain enabled; sandbox failures are not skipped or retried without confinement. PTY tests accept Linux EIO as terminal EOF while still requiring the CLI to exit successfully.

## Distribution

The root tarball contains minified CLI/SDK JavaScript, minified Web assets, public SDK type declarations and license notices. Production builds disable JavaScript, CSS and declaration source maps, remove ordinary code comments and strip generated source-location comments from declarations. SDK types remain readable because they describe the public API, not its implementation. Development retains source access and HMR.

Every root build runs pnpm check:distribution. It rejects source files, tests, unexpected assets, separate or inline source maps and generated source-location comments, including files accidentally copied into dist. Packing runs this build through prepack. Do not bypass lifecycle scripts for releases; the command below skips them only after a verified build.

These measures exclude original TypeScript/TSX and reconstruction metadata, but do not make distributed code confidential or prevent reverse engineering. Anyone running the package can inspect or reformat its JavaScript and observe its behavior; minification also reduces stack-trace readability. Native binaries and obfuscation cannot guarantee otherwise. Code that must remain confidential must run on a controlled remote service and must not be distributed to clients. Loop currently runs locally.

Verify a local package after building:

```bash
pnpm --config.ignore-scripts=true pack
pnpm verify:package loop-harness-loop-0.1.0.tgz
```

Verification checks the actual tarball's file list and installed Loop payload, installs production dependencies, rejects module resolution outside the installation, and checks SDK imports, CLI help, Web assets/API and shutdown. Third-party production dependencies keep their own published contents and license notices; Loop's content checks cover its own distribution.

Publish the verified tarball from an npm account with publishing rights in the `loop-harness` organization. The root manifest sets public access and the npm registry; packaging and local verification do not publish a release. Complete npm authentication and any required two-factor verification locally.

```bash
npm whoami --registry=https://registry.npmjs.org/
npm publish ./loop-harness-loop-0.1.0.tgz --access public --registry=https://registry.npmjs.org/
npx @loop-harness/loop@0.1.0 web
```

The executable remains `loop`; internal `@loop/*` packages stay private and are bundled into this single public package. The [Check workflow](../.github/workflows/check.yml) builds, packs and verifies on Linux and macOS. It uses a version-independent `loop.tgz` filename so version bumps do not require editing CI. Ordinary push and PR checks do not publish.

## Automated releases

The [Release workflow](../.github/workflows/release.yml) runs on pushes of `v*` tags. It accepts only stable `vX.Y.Z` tags matching the root package version, on commits already merged into `main`. Prerelease tags are rejected and cannot update npm's `latest` channel.

Before the first automated release, configure a Trusted Publisher in the npm package settings. Select GitHub Actions, enter this repository's owner and name, and set the workflow filename to `release.yml` (without a directory). Allow direct publishing with `npm publish` if npm displays an allowed-actions setting. Leave the environment field empty; this workflow does not use a GitHub deployment environment. The package's `repository.url` must match the GitHub repository exactly, including case. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

Publishing uses Node.js 24, npm 11.5.1 or newer and short-lived OIDC credentials. Only the publish job receives `id-token: write`; no npm token secret is needed. This repository is public, and the published package includes npm provenance. Configuring the workflow file does not configure npm's trust relationship.

For each release:

1. Update the root package version. Internal workspace packages remain private.
2. Move pending changelog entries into a matching `## [X.Y.Z] - YYYY-MM-DD` section with release notes and a valid date no later than the current UTC date. Keep an empty `## [Unreleased]` above it.
3. Merge those changes, then create and push the matching tag on that commit. For example, after preparing version `0.1.1`:

```bash
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

The workflow rejects existing npm versions and stops if registry availability cannot be confirmed. It runs the shared Check workflow on both operating systems, then publishes the exact tarball verified on Linux after both jobs pass. The publish job downloads that run's artifact and does not rebuild or execute package lifecycle scripts. Release runs are serialized. The workflow publishes to npm's `latest` channel; it does not create a GitHub Release.

If validation, tests or authentication fail, publishing stops. Configure npm trust before retrying an authentication failure. Before retrying an uncertain publish, check npm for that version: published versions cannot be overwritten. Do not move an existing release tag; prepare a new version for changed code. The already published `0.1.0` is not a test release for this workflow.
