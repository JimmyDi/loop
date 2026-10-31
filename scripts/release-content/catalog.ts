import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { ReleaseContent } from "./types";

export const compareVersions = (left: string, right: string): number => {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

export const validateContent = (value: ReleaseContent): ReleaseContent => {
  if (
    value.schemaVersion !== 1 ||
    !/^\d+\.\d+\.\d+$/.test(value.version) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    new Date(value.date + "T00:00:00Z").toISOString().slice(0, 10) !== value.date ||
    !value.title?.trim() ||
    !value.summary?.trim() ||
    !value.notes?.trim() ||
    !Array.isArray(value.pages)
  ) {
    throw new Error("Invalid release content.");
  }
  const slugs = new Set<string>();
  for (const page of value.pages) {
    if (
      !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(page.slug) ||
      slugs.has(page.slug) ||
      !page.title?.trim() ||
      !page.group?.trim() ||
      !page.markdown?.trim() ||
      !/^[\w./-]+\.md$/.test(page.source) ||
      page.source.includes("..")
    ) {
      throw new Error("Invalid documentation page.");
    }
    slugs.add(page.slug);
  }
  if (value.pages.length && !slugs.has("getting-started"))
    throw new Error("Release needs a getting-started page.");
  return value;
};

export const readReleaseCatalog = async (root: string): Promise<ReleaseContent[]> => {
  const directory = join(root, "releases");
  const names = (await readdir(directory)).filter((name) => /^\d+\.\d+\.\d+\.json$/.test(name));
  const releases = await Promise.all(
    names.map(async (name) => {
      const release = validateContent(JSON.parse(await readFile(join(directory, name), "utf8")));
      if (name !== release.version + ".json") throw new Error("Release filename/version mismatch.");
      return release;
    }),
  );
  return releases.sort((a, b) => compareVersions(b.version, a.version));
};

export const publicReleaseCatalog = (
  releases: ReleaseContent[],
  published: string[],
): ReleaseContent[] => {
  const latest = [...published].sort((a, b) => compareVersions(b, a))[0];
  return releases
    .filter((release) => published.includes(release.version))
    .map((release) => ({ ...release, pages: release.version === latest ? release.pages : [] }));
};
