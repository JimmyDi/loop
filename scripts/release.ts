type ReleaseManifest = {
  name: string;
  version: string;
  private?: boolean;
  repository?: { type: string; url: string };
  publishConfig?: { access: string; registry: string };
};

export const validateRelease = (
  manifest: ReleaseManifest,
  changelog: string,
  tag: string,
  repository: string,
  today = new Date().toISOString().slice(0, 10),
): void => {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    throw new Error("Release tags must be stable versions in vX.Y.Z format.");
  if (tag !== `v${manifest.version}`)
    throw new Error("Release tag must match the root package version.");
  if (manifest.name !== "@loop-harness/loop" || manifest.private !== false)
    throw new Error("The release must be the public @loop-harness/loop package.");
  if (
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig.registry !== "https://registry.npmjs.org/"
  )
    throw new Error("Release publishing must use public access on the npm registry.");
  if (
    !repository ||
    manifest.repository?.type !== "git" ||
    manifest.repository.url !== `git+https://github.com/${repository}.git`
  )
    throw new Error("Package repository must match the GitHub repository for npm provenance.");

  const sections = [...changelog.matchAll(/^## (.+)\r?$/gm)];
  if (sections[0]?.[1] !== "[Unreleased]")
    throw new Error("Changelog must start with an Unreleased section.");
  const release = sections[1];
  const heading = release?.[1].match(/^\[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/);
  if (heading?.[1] !== manifest.version)
    throw new Error("The newest changelog release must match the package version and have a date.");
  const date = heading[2];
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date ||
    date > today
  )
    throw new Error("The release date must be a valid date no later than today (UTC).");
  const unreleased = changelog.slice(sections[0].index + sections[0][0].length, release.index);
  if (unreleased.trim())
    throw new Error("Move pending changelog entries into the release section.");
  const notes = changelog.slice(release.index + release[0].length, sections[2]?.index);
  if (!/^- \S/m.test(notes)) throw new Error("The changelog release must contain release notes.");
};
