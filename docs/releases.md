# Release documentation and changelog

Loop's website and application consume the same immutable release content. Working-tree
documentation and CHANGELOG.md remain authoring sources, never direct public website content.

## Prepare a version

After explicitly preparing the package version and dated changelog section, update and review
the documentation, then run from the repository root:

```bash
pnpm release:content "Concise release highlights"
```

This writes releases/X.Y.Z.json with notes and versioned Markdown pages. Regenerate the
candidate after further documentation changes; published snapshots must remain unchanged.
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
search and RSS. Public website jobs are serialized.

Pages deploys after npm publication, so the website can briefly retain the preceding version.
A failed website job preserves the deployed site; retry Website without republishing npm.
Homepage development remains independent of application runtime and build commands.

Local development uses releases/published.json, checked against npm when bootstrapped. CI
requires LOOP_PUBLISHED_VERSIONS from the registry-check step. Update the local allowlist
after a confirmed release. This is build metadata, not a user-facing setting.

## Routes and application content

- docs/ and docs/latest/ resolve to the newest published documentation snapshot.
- docs/X.Y.Z/topic/ preserves versioned documentation and links.
- changelog/ lists published releases; changelog/X.Y.Z/ shows full notes.
- changelog.xml provides release RSS.
- Settings bundles its own version and the preceding available snapshot without online checks.

Initial documentation snapshots were imported from public v0.4.0 and v0.3.1 source tags.
Earlier releases retain original changelog notes without reconstructed documentation.

## Verification

Run affected release-content and Settings tests, website type/format checks, and the static
website build. Check deep links under the Pages subdirectory and portable relative base.
The website needs no model or application backend.

Related: [development](development.md), [website](../website/README.md),
[changelog maintenance](../CONTRIBUTING.md#changelog),
[Settings help](../packages/web-ui/src/frontend/docs/help-updates.md).
