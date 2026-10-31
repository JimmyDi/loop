# Loop website

An independently maintained React marketing site with CSS Modules and build-time static HTML. Source, bilingual copy, styles and assets live in this directory. The site does not import Loop application packages or call model or application APIs.

## Development

Use Node.js 24+ and pnpm 11. Install from the repository root:

```bash
pnpm install
pnpm --filter @loop/website dev
```

Vite prints the local preview address. No Loop backend or model configuration is needed.

## Validation

Run website checks independently from application checks:

```bash
pnpm --filter @loop/website typecheck
pnpm --filter @loop/website check
```

Select tests for the changed components, for example:

```bash
pnpm --filter @loop/website exec vitest run src/components/Interfaces.test.tsx
```

The independent website CI runs all website tests. Application tests do not include this directory.

## Build and deployment

```bash
pnpm --filter @loop/website build
pnpm --filter @loop/website preview
```

Deploy only `website/dist/` to a static host. No server, credentials or environment variables are needed. The default build targets a domain root; use `build --base=/loop/` for a specific subdirectory or `build --base=./` for portable relative asset URLs.

The [Website workflow](../.github/workflows/website.yml) checks types, formatting, tests and the production build on pull requests. PR builds do not deploy. On `main`, the workflow checks the merged commit and deploys that exact artifact to GitHub Pages. A failed check or build prevents deployment.

Automatic runs respond to changes in `website/`, the website workflow and shared dependency manifests or lockfile. Manual runs are supported; only `main` deploys. The workflow installs the website workspace and does not build Loop or publish an npm package.

One-time repository setup:

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
2. Merge website changes into `main`, or run **Actions → Website** on `main`.
3. Use the URL reported by the `github-pages` deployment for the repository's **About → Website** field.

GitHub supplies deployment credentials. Build jobs have read-only repository access; only the deployment job receives Pages write and OIDC permissions. Repository environment rules may require deployment approval. Adding the workflow locally does not enable Pages or publish the site.

## Page and content maintenance

[App](src/App.tsx) composes the header, hero, capabilities, interface examples and footer. Edit English copy in [en.ts](src/i18n/en.ts) and Chinese copy in [zh.ts](src/i18n/zh.ts). [translations.ts](src/translations.ts) assembles the dictionaries and exports their shared types; both languages must contain the same translation keys. Edit components in [src/components](src/components/), and shared colors in [theme.css](src/theme.css). Keep component styles and tests alongside the component.

- The header contains the theme-aware Loop mark, wordmark and language switch. It contracts into a translucent bar as the page scrolls.
- The hero contains the startup command and a narrower, centered product screenshot. Its animated cloud background and mouse character trail respect reduced motion; the trail excludes text, controls and the product preview.
- Three capability rows promote model/provider choice, control over longer tasks, and MCP/Skills integrations. Desktop rows alternate image placement with bottom-aligned copy; mobile layouts stack copy above the preview. The feature section uses system fonts, while the rest of the page uses local Montserrat with system Chinese fallbacks.
- The interface section places centered copy above an 880-pixel command workbench. Its entry-choice sentence starts on a separate line. Web, CLI and SDK tabs share a fixed-height panel with internal code scrolling. Web shows the startup command, CLI shows interactive DeepSeek startup, and SDK shows a complete DeepSeek call with cleanup. Terminal panels remain dark; TypeScript uses theme-aware CSS syntax colors without a highlighting dependency. Review examples and documentation links manually when contracts change.
- The footer follows the interface section and opens local privacy and terms dialogs. External documentation links open in new tabs.

Product changes do not regenerate website copy, examples or assets. The site does not run models, tools, configuration commands or the displayed code examples.

## Product media

All product media captures the real frontend with fictional engineering data. Capture tools remain separate from website source, dependencies, development and builds. Asset notices document the scenes, provenance and update requirements.

| Media | Frames per language/theme | Dimensions | Notice |
| --- | --- | --- | --- |
| Hero product preview | 1 | 1440 × 800 | [Product](public/product/NOTICE.md) |
| Provider configuration and model/effort selection | 5 | 1000 × 660 | [Providers](public/provider-demo/NOTICE.md) |
| Queues, steering, Stop/Resume and context compaction | 9 | 1056 × 696 | [Workflow](public/workflow-demo/NOTICE.md) |
| STDIO/HTTP MCP and project Skills | 4 | 1020 × 684 | [MCP and Skills](public/integration-demo/NOTICE.md) |

Every scene has Chinese/English and native Light/Dark variants. Captures exclude scrollbars, surrounding backing margins and metadata. Animation previews fill their containers without additional borders or letterboxing; proportional corner clipping removes residual captured backgrounds at every display size. Preserve scene names, dimensions and paired variants when replacing assets, with each file below 250 KB.

Provider and MCP/Skills sequences loop over 18 seconds; the workflow sequence loops over 31 seconds. Each has a compact play/pause control without scene navigation. Reduced motion keeps frames static; hidden or offscreen previews stop advancing.

Maintain brand copies deliberately and preserve the [brand notice](public/brand/NOTICE.md), [font notice](public/fonts/README.md) and [font license](public/fonts/OFL.txt).

## Themes and languages

The live system color scheme selects native product captures through media-qualified picture sources, including during playback, without a reload or playback reset. Capture each product theme directly rather than recoloring with filters. Code-rendered visuals use shared theme colors. The page and browser toolbar remain theme-aware without JavaScript.

The first preferred browser language selects Chinese or English before first paint. The language switch updates copy, product assets, accessible labels and metadata in place. Manual selection lasts for the current page and is not stored in cookies or local storage. Reloading returns to browser preference.

Production contains Chinese static HTML and an inert English template. A small bootstrap selects the initial markup and metadata before React hydrates it. Chinese content remains available without JavaScript; copying, language switching and tab selection require JavaScript. Development uses client rendering.

The site has no analytics or third-party font requests. Privacy and terms distinguish the static website from the Loop application and external services.

## Architecture and repository integration

Shared Brand, ExternalLink, SectionHeading, FeatureCard and CopyCommand components own repeated presentation. LanguageProvider manages language and metadata; ProductScreenshot owns native theme selection; InterfaceWorkbench owns tab selection. Hooks own copying, header scrolling and demo playback. HeroPointer separates browser lifecycle from character-field calculations.

The website architecture checks cover colocated styles/tests, a 150-line component limit, static local imports, declared dependencies and cycles. Translation dictionaries are data. No website module is imported by the application, and website code does not import application packages.

Repository integration is limited to workspace registration and the shared lockfile, the independent website workflow, the root README link, the root formatter exclusion and Website entries in the root Changelog. Application builds, exports, package contents, type checks and test discovery exclude the website. Keep application feature work separate when selecting files or shared-file changes for a future commit.

[The build script](scripts/build.mjs) runs client and temporary server builds, renders [prerender.tsx](src/prerender.tsx) into the HTML template, and removes temporary output in a finally block. Only client assets and static HTML remain in `dist`; no server is deployed.
