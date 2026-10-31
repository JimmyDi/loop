# Loop website

- This directory is a manually maintained, static marketing site.
- Keep all website implementation, content, styles and assets inside this directory.
- Do not import Loop application packages, source, types, styles, configuration or APIs.
- Do not export website modules for the application to consume.
- Documentation and changelog pages may consume immutable release snapshots from releases/
  through build tooling. Public builds must filter snapshots against npm-confirmed published
  versions; never render working-tree documentation or Unreleased entries.
- Keep runtime imports isolated; release tooling must not import application implementations.
- Update copy and product previews manually after reviewing implemented behavior.
- Brand assets are independent, unmodified copies. Updating the application does not update them.
- Keep website development, builds and deployment independent of Loop application commands.
- Install with pnpm from the repository root and retain the single root lockfile.
- Do not run a model, start the Loop backend, or include real conversations or local runtime data.
- Manually reviewed captures of the real frontend with fictional demo data are allowed as static
  assets. Keep recording tools outside website builds; never capture credentials or real sessions.
- Prepare separate Light and Dark assets for every frame or clip of product demo animations,
  including every supported language. Keep scenes, dimensions and timing aligned across themes.
- Select the matching animation assets using the page's live system color scheme, updating without
  a reload. Capture each product theme directly; do not simulate Dark with filters or an overlay.
- Use shared theme colors for code-rendered illustrations and animations. Verify both themes and
  require paired theme assets and matching source selection in affected demo tests.
