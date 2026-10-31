import { expect, test } from "vitest";

import {
  applicationReleaseContent,
  compareVersions,
  publicReleaseCatalog,
  validateContent,
} from "./catalog";
import { changelogReleases } from "./changelog";
import type { ReleaseContent } from "./types";

const release = (version: string): ReleaseContent => ({
  schemaVersion: 1,
  version,
  date: "2026-01-01",
  title: "Loop " + version,
  summary: "Synthetic release",
  notes: "### Added\n\n- Synthetic feature.",
  pages: [
    {
      slug: "getting-started",
      title: "Start",
      group: "Start",
      source: "README.md",
      markdown: "# Start",
    },
  ],
});

test("pending changelog entries never become releases", () => {
  expect(
    changelogReleases(
      "## [Unreleased]\n\n- Secret future feature\n\n## [1.0.0] - 2026-01-01\n\n- Released feature",
    ),
  ).toEqual([{ version: "1.0.0", date: "2026-01-01", notes: "- Released feature" }]);
});

test("public content requires publication and application content stops at its own version", () => {
  const releases = [release("1.1.0"), release("1.0.0"), release("0.9.0")];
  expect(publicReleaseCatalog(releases, ["1.0.0", "0.9.0"]).map((entry) => entry.version)).toEqual([
    "1.0.0",
    "0.9.0",
  ]);
  const app = applicationReleaseContent(releases, "1.0.0");
  const published = publicReleaseCatalog(releases, ["1.0.0", "0.9.0"]);
  expect(published[0].pages).toHaveLength(1);
  expect(published[1].pages).toHaveLength(0);
  expect(
    publicReleaseCatalog(releases, ["2.0.0", "1.0.0"]).every((entry) => !entry.pages.length),
  ).toBe(true);
  expect(app.releases.map((entry) => entry.version)).toEqual(["1.0.0", "0.9.0"]);
  expect(app.releases[0]).not.toHaveProperty("pages");
  expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
});

test("invalid snapshots and duplicate page routes fail closed", () => {
  expect(() => validateContent({ ...release("1.0.0"), date: "2026-02-30" })).toThrow();
  const value = release("1.0.0");
  value.pages.push(value.pages[0]);
  expect(() => validateContent(value)).toThrow();
});
