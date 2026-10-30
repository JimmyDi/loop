import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { expect, test } from "vitest";

const execute = promisify(execFile);

const workflow = async () =>
  parse(await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"));

test("both registry jobs use the verified artifact and Release waits for both publications", async () => {
  const { jobs, permissions } = await workflow();
  expect(permissions).toEqual({ contents: "read" });
  for (const name of ["publish", "github-package"]) {
    expect(jobs[name].needs).toBe("verify");
    expect(
      jobs[name].steps.find((step: { uses?: string }) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with.name,
    ).toBe("loop-release-package");
  }
  expect(jobs.publish.permissions).toEqual({ contents: "read", "id-token": "write" });
  expect(jobs["github-package"].permissions).toEqual({ contents: "read" });
  expect(jobs["github-package"].steps.at(-1).env.NODE_AUTH_TOKEN).toBe(
    "$" + "{{ secrets.GH_PACKAGES_TOKEN }}",
  );
  expect(jobs["github-package"].steps.at(-1).run).toContain(
    "--ignore-scripts --registry=https://npm.pkg.github.com/",
  );
  expect(jobs["github-release"].needs).toEqual(["publish", "github-package"]);
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
