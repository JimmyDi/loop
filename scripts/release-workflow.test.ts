import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, matchesGlob } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { expect, test } from "vitest";

const execute = promisify(execFile);

const workflow = async () =>
  parse(await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"));

test.each([
  ["v0.5.0", true],
  ["v10.0.0", true],
  ["voice-v1.0.1", false],
  ["voice-v2.0.0", false],
  ["main", false],
])("application tag filter handles %s", async (tag, expected) => {
  const patterns: string[] = (await workflow()).on.push.tags;
  expect(patterns.some((pattern) => matchesGlob(tag, pattern))).toBe(expected);
});

test("npm publishes the verified artifact before GitHub Release creation", async () => {
  const { jobs, permissions } = await workflow();
  expect(permissions).toEqual({ contents: "read" });
  expect(Object.keys(jobs)).toEqual(["validate", "verify", "publish", "github-release"]);
  expect(jobs.publish.needs).toBe("verify");
  expect(
    jobs.publish.steps.find((step: { uses?: string }) =>
      step.uses?.startsWith("actions/download-artifact@"),
    ).with.name,
  ).toBe("loop-release-package");
  expect(jobs.publish.permissions).toEqual({ contents: "read", "id-token": "write" });
  expect(jobs.publish.steps.at(-1).run).toContain(
    "--provenance --ignore-scripts --registry=https://registry.npmjs.org/",
  );
  expect(jobs["github-release"].needs).toBe("publish");
  expect(jobs["github-release"].permissions).toEqual({ contents: "write" });
});

test.each(["missing", "existing", "api-failure"])(
  "application release publishes named assets and handles %s state",
  async (scenario) => {
    if (process.platform === "win32") return;
    const root = await mkdtemp(join(tmpdir(), "loop-release-workflow-"));
    try {
      await mkdir(join(root, "bin"));
      await writeFile(join(root, "loop.tgz"), "synthetic");
      await writeFile(join(root, "release-notes.md"), "Synthetic notes.");
      await writeFile(
        join(root, "bin/gh"),
        [
          "#!/bin/bash",
          'echo "$*" >> "$RELEASE_TEST_LOG"',
          'if [[ "$2" == "view" && "$RELEASE_TEST_SCENARIO" != "existing" ]]; then exit 1; fi',
          'if [[ "$2" == "create" && "$RELEASE_TEST_SCENARIO" == "api-failure" ]]; then exit 1; fi',
          "exit 0",
        ].join("\n"),
        { mode: 0o700 },
      );
      const step = (await workflow()).jobs["github-release"].steps.at(-1);
      const run = execute("bash", ["-c", step.run], {
        cwd: root,
        env: {
          ...process.env,
          PATH: join(root, "bin") + ":" + process.env.PATH,
          RELEASE_TAG: "v0.5.0",
          RELEASE_TEST_SCENARIO: scenario,
          RELEASE_TEST_LOG: join(root, "calls"),
        },
      });
      if (scenario === "missing") await run;
      else await expect(run).rejects.toThrow();
      const calls = await readFile(join(root, "calls"), "utf8");
      expect(calls.includes("release create")).toBe(scenario !== "existing");
      expect(calls).not.toContain("--clobber");
      if (scenario === "missing") {
        expect(calls).toContain(
          "release create v0.5.0 loop.tgz SHA256SUMS --verify-tag --title Loop v0.5.0 — CLI, SDK & Web --notes-file release-notes.md --latest",
        );
        expect(await readFile(join(root, "SHA256SUMS"), "utf8")).toMatch(
          /^[a-f0-9]{64} {2}loop.tgz\n$/,
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
