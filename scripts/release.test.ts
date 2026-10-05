import { expect, test } from "vitest";

import { validateRelease } from "./release";

const manifest = {
  name: "@loop-harness/loop",
  version: "0.1.1",
  private: false,
  repository: { type: "git", url: "git+https://github.com/example/loop.git" },
  publishConfig: { access: "public", registry: "https://registry.npmjs.org/" },
};

const changelog =
  "## [Unreleased]\n\n## [0.1.1] - 2026-10-05\n\n### Fixed\n\n- CLI: fix startup.\n";

const check = (
  options: {
    manifest?: typeof manifest;
    changelog?: string;
    tag?: string;
    repository?: string;
  } = {},
) =>
  validateRelease(
    options.manifest ?? manifest,
    options.changelog ?? changelog,
    options.tag ?? "v0.1.1",
    options.repository ?? "example/loop",
    "2026-10-05",
  );

test("accepts a stable release with matching identity and dated notes", () => {
  expect(() => check()).not.toThrow();
  expect(() => check({ changelog: changelog.replaceAll("\n", "\r\n") })).not.toThrow();
});

test("reads the latest release independently of historical notes", () => {
  const history = "## [0.1.0] - 2026-10-01\n\n### Added\n\n- CLI: initial release.\n\n";
  const withHistory = changelog + "\n" + history;
  expect(() => check({ changelog: withHistory })).not.toThrow();
  expect(() => check({ changelog: withHistory.replace("- CLI: fix startup.", "") })).toThrow(
    "release notes",
  );
  expect(() =>
    check({ changelog: changelog.replace("## [0.1.1]", history + "## [0.1.1]") }),
  ).toThrow("newest changelog");
});

test("requires exactly one Unreleased section before all releases", () => {
  const release = changelog.replace("## [Unreleased]\n\n", "");
  for (const invalid of [
    release,
    release + "\n## [Unreleased]\n",
    "## [Unreleased]\n\n" + changelog,
    changelog + "\n## [Unreleased]\n",
    release + "\n## [Unreleased]\n\n## [0.1.0] - 2026-10-01\n\n- Previous release.\n",
  ])
    expect(() => check({ changelog: invalid })).toThrow("Unreleased");
  expect(() => check({ changelog: "## [Unreleased]\n" })).toThrow("newest changelog");
});

test.each(["v01.1.1", "v0.1", "0.1.1", "v0.1.1-beta.1", "v0.1.1+build", "v0.1.1\n"])(
  "rejects malformed or prerelease tag %s before it can publish to latest",
  (tag) => expect(() => check({ tag })).toThrow("stable versions"),
);

test("rejects version mismatches and incorrect package or registry identity", () => {
  expect(() => check({ tag: "v0.1.2" })).toThrow("package version");
  for (const change of [{ name: "other-package" }, { private: true }])
    expect(() => check({ manifest: { ...manifest, ...change } })).toThrow(
      "public @loop-harness/loop",
    );
  for (const change of [{ access: "restricted" }, { registry: "https://example.com/" }])
    expect(() =>
      check({ manifest: { ...manifest, publishConfig: { ...manifest.publishConfig, ...change } } }),
    ).toThrow("public access");
  expect(() => check({ repository: "different/loop" })).toThrow("repository");
});

test.each(["2026-02-30", "2026-13-01", "2026-10-06"])(
  "rejects an invalid or future release date %s",
  (date) =>
    expect(() => check({ changelog: changelog.replace("2026-10-05", date) })).toThrow(
      "release date",
    ),
);

test("requires current release notes and an empty Unreleased section", () => {
  expect(() => check({ changelog: changelog.replace("[Unreleased]", "[Pending]") })).toThrow(
    "Unreleased",
  );
  expect(() => check({ changelog: changelog.replace("[0.1.1]", "[0.1.0]") })).toThrow(
    "newest changelog",
  );
  expect(() => check({ changelog: changelog.replace(" - 2026-10-05", "") })).toThrow("have a date");
  expect(() => check({ changelog: changelog.replace("- CLI: fix startup.", "") })).toThrow(
    "release notes",
  );
  expect(() =>
    check({ changelog: changelog.replace("[Unreleased]", "[Unreleased]\n\n- Pending work.") }),
  ).toThrow("pending changelog");
});
