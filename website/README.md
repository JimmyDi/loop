# Loop website

An independently maintained React website with CSS Modules and build-time static HTML. The
homepage uses reviewed bilingual marketing copy. Docs follows only the latest npm release
without a version selector; Docs and full release-note navigation keep the page mounted while loading and
supports browser Back/Forward. Changelog retains release history. They consume
release snapshots through build tooling without importing application packages or calling
model/application APIs. See [release content lifecycle](../docs/releases.md).

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

Automatic runs respond to website/release-content changes, shared manifests and successful
Release workflow completion. Manual retries are supported. Public builds use main and verify
versions against npm before rendering; PR builds never deploy. The workflow installs only
the website workspace and does not build Loop or publish an npm package.

One-time repository setup:

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
2. Merge website changes into `main`, or run **Actions → Website** on `main`.
3. Use the URL reported by the `github-pages` deployment for the repository's **About → Website** field.

GitHub supplies deployment credentials. Build jobs have read-only repository access; only the deployment job receives Pages write and OIDC permissions. Repository environment rules may require deployment approval. Adding the workflow locally does not enable Pages or publish the site.

## Page and content maintenance

[App](src/App.tsx) composes the header, hero, capabilities, interface examples and footer. Edit English copy in [en.ts](src/i18n/en.ts) and Chinese copy in [zh.ts](src/i18n/zh.ts). [translations.ts](src/translations.ts) assembles the dictionaries and exports their shared types; both languages must contain the same translation keys. Edit components in [src/components](src/components/), and shared colors in [theme.css](src/theme.css). Keep component styles and tests alongside the component.

- The header contains the theme-aware Loop mark, wordmark, plain-text Docs / Changelog / Blog links and language switch. On scroll it smoothly compacts and floats below the top edge with rounded corners and a translucent surface. All pages share the same animation and stable blog-aligned width. Reduced motion disables transitions.
- The hero contains the startup command and a narrower, centered product screenshot. Its animated cloud background and mouse character trail respect reduced motion; the trail excludes text, controls and the product preview.
- Three capability rows promote model/provider choice, control over longer tasks, and MCP/Skills integrations. Desktop rows alternate image placement with bottom-aligned copy; mobile layouts stack copy above the preview. The feature section uses system fonts, while the rest of the page uses local Montserrat with system Chinese fallbacks.
- The interface section places centered copy above an 880-pixel command workbench. Its entry-choice sentence starts on a separate line. Web, CLI and SDK tabs share a fixed-height panel with internal code scrolling. Web shows the startup command, CLI shows interactive DeepSeek startup, and SDK shows a complete DeepSeek call with cleanup. Terminal panels remain dark; TypeScript uses theme-aware CSS syntax colors without a highlighting dependency. Review examples and documentation links manually when contracts change.
- The footer follows the interface section and opens local privacy and terms dialogs. External documentation links open in new tabs.

Product changes do not regenerate homepage copy, examples or assets. Published Docs and
Changelog update after successful releases; working-tree docs and Unreleased entries never
become website content. The site does not run displayed code examples.

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

Repository integration includes build-time release snapshots and tooling, workspace registration,
the shared lockfile and the independent website workflow. Application runtime and SDK never
import website code. Application builds and published package contents exclude website assets.

[The build script](scripts/build.mjs) runs client and temporary server builds, renders [prerender.tsx](src/prerender.tsx) into the HTML template, and removes temporary output in a finally block. Only client assets and static HTML remain in `dist`; no server is deployed.


## Blog

The blog lives at `/blog/` and shares the website language switch and theme colors for the page, cards, search field and illustrations. The index starts with a right-aligned search field without introductory copy or an article count. It uses up to
three columns; the newest article spans two, then becomes full-width in the two-column
layout and a single card on phones. Navigation shares the blog’s 1400px container and 32px desktop / 20px mobile gutters on every page, including on scroll.
Articles have section navigation, copy-link feedback, code copying and related reading.

Author paired Markdown files in `content/blog/<slug>.zh.md` and `<slug>.en.md`. Each file
starts with a flat frontmatter block containing `title`, `summary`, `author`, `category`,
`publishedAt` and an explicit boolean `draft`. The category is `engineering`, `product` or
`guides`; dates use `YYYY-MM-DD`. `updatedAt` is optional and cannot precede publication.
Use plain single-line strings or JSON double-quoted strings. Nested YAML is unsupported.

Public pairs need matching author, category and dates, with both `draft: false`. Incomplete
draft pairs are excluded; incomplete public pairs fail the build. Publishing is controlled
by the draft flag rather than a scheduler. Sort order is publication date descending, then
slug. Reading times are estimated at build time. The initial essays discuss general design
principles rather than promise unreleased application behavior.

Markdown disables raw HTML and unsafe link schemes. Internal links start with `blog/`,
`docs/` or `changelog/`; section links use `#heading-id`. Put raster images in
`public/blog/<slug>/` and reference them relative to that directory, with alt text. Missing
assets and path traversal fail validation. External images, SVG embeds and arbitrary HTML
are unsupported. Review images in both themes; product captures need native theme pairs.
Code fences display a language label and copy action. Images open a native modal dialog;
Escape closes it and native focus returns to the opener.

Production contains both static article translations; browser bundles contain only the
article index and section metadata. Internal article navigation loads both translations
from static HTML while retaining the current page until the response succeeds. Language
changes then update the article without another request. Back/Forward restores recorded
scroll positions; failed requests fall back to ordinary page navigation.

Set `WEBSITE_ORIGIN` to the public HTTPS origin at build time to emit canonical URLs,
Open Graph URLs and `sitemap.xml`, including the configured deployment base. Without it,
preview builds omit public URLs and the sitemap. Relative-base builds omit the sitemap;
use an explicit root-relative base for a public deployment. All articles include title,
description, article dates and BlogPosting structured data. Both languages share one URL;
Chinese is the static default for crawlers. Separate indexed locale routes and RSS are not
implemented. The output includes `404.html`; configure the static host to serve it with a
404 status for missing paths rather than rewrite them to the homepage. Development and
Vite preview fallback routing do not establish production HTTP status behavior.


The latest two-column list card uses the expanded article component: category/date strip, title, summary, author/reading time and illustration. Other grid cards use its compact form without the illustration. Expanded cards stack the illustration below the text on phones.

A headerless article table below the cards groups publication date and category on the left, followed by title, author and right-aligned reading time. It follows the shared language, with search beside the All articles heading and a centered View more button that appends 10 rows at a time until all results are visible. Search filters the table and resets the visible rows to the first 10; search results use the same incremental pagination. The cards remain visible. The table scrolls horizontally on narrow screens. Titles link to the corresponding article.

The source index is [content/blog/index.jsonl](content/blog/index.jsonl), maintained alongside the Markdown articles. Each line is one bilingual article record containing its slug and listing metadata, without HTML or section headings. Records are ordered by publication date descending, then slug.

When adding, updating, deleting or changing publication status of an article, the agent must directly update content/blog/index.jsonl in the same change. Add or remove its bilingual record and synchronize titles, summaries, dates, authors, categories and estimated reading times. Keep records ordered by publication date descending, then slug; exclude drafts. Reading time is at least one minute, rounding up the Markdown body word count divided by 400 for Chinese or 220 for English. Count each Han character or contiguous run of other letters/numbers as one word.

Development and builds validate the maintained index against the published Markdown pairs. Missing, duplicate, reordered or stale records fail validation and identify the index to update. Builds never rewrite the source index; there is no index-generation command.

Blog cards and the archive use this maintained index through virtual:blog-index for search and View more pagination. Builds also export a public blog/index.json copy. The index is bundled for initial rendering, so pagination does not fetch Markdown or request additional pages. Article bodies remain in their static article pages.
