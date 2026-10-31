# Release documentation and changelog

Loop's website and application consume the same release content. Working-tree
documentation and CHANGELOG.md remain authoring sources, never direct public website content.

## Prepare a version

For explicitly requested release preparation or an authorized application release, the agent
must generate the snapshot automatically under [release preparation instructions](../AGENTS.md#release-preparation).
Finalize the confirmed version, dated notes and source docs first, then generate concise
English highlights and review the snapshot before building or packaging. Regenerate after
source changes and require snapshot validation before publication. CI validates committed
snapshots; it does not generate them. No separate reminder is needed.

After explicitly preparing the package version and dated changelog section, update and review
the documentation, then run from the repository root:

```bash
pnpm release:content "Concise release highlights"
```

This writes releases/X.Y.Z.json with notes and release Markdown pages. Regenerate the
candidate after further documentation changes; published release notes must remain unchanged.
Only the latest published release retains documentation; older entries retain notes with empty pages.
The release validator requires the snapshot to match the final source exactly. This command
does not change versions, commit, tag, publish, or deploy.

Snapshots preserve original English documentation. Navigation supports Chinese and English
and identifies English-only documents. Source Markdown images and raw HTML are omitted;
implementation links point to the matching public source tag.

## Publication

Release validates metadata and documentation before verifying and publishing the npm package.
Website runs after successful Release completion, normal website changes and manual retries.
Before rendering, it obtains npm's actual stable version list. Registry failures stop deployment.

Only snapshots whose versions exist on npm enter public content. Unreleased entries, candidate
snapshots and unpublished historical versions are excluded from static pages, browser data,
search. Public website jobs are serialized.

Pages deploys after npm publication, so the website can briefly retain the preceding version.
A failed website job preserves the deployed site; retry Website without republishing npm.
Homepage development remains independent of application runtime and build commands.

Local development uses releases/published.json, checked against npm when bootstrapped. CI
requires LOOP_PUBLISHED_VERSIONS from the registry-check step. Update the local allowlist
after a confirmed release. This is build metadata, not a user-facing setting.

## Routes and application content

- docs/ and docs/topic/ show only the latest npm-published version, without a version selector.
- Historical documentation routes are not generated.
- changelog/ lists published releases; changelog/X.Y.Z/ shows full notes.
- Settings bundles its own version and the preceding available snapshot without online checks.

Documentation was imported from the public v0.4.0 source tag. Older releases retain original
changelog notes only. Builds stop if the latest npm release lacks its documentation snapshot.

## Verification

Run affected release-content and Settings tests, website type/format checks, and the static
website build. Check deep links under the Pages subdirectory and portable relative base.
The website needs no model or application backend.

Related: [development](development.md), [website](../website/README.md),
[changelog maintenance](../CONTRIBUTING.md#changelog),
[Settings help](../packages/web-ui/src/frontend/docs/help-updates.md).
