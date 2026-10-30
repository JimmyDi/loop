import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { expect, test } from "vitest";

const execute = promisify(execFile);

test.each(["new", "published", "tag-mismatch", "manual-mismatch", "api-failure"])(
  "voice version preparation handles %s before starting expensive builds",
  async (scenario) => {
    if (process.platform === "win32") return;
    const root = await mkdtemp(join(tmpdir(), "voice-version-"));
    try {
      const workflow = parse(
        await readFile(
          new URL("../../../../../../.github/workflows/voice-native.yml", import.meta.url),
          "utf8",
        ),
      );
      const step = workflow.jobs.prepare.steps.find(
        (item: { id?: string }) => item.id === "version",
      );
      await writeFile(join(root, "node"), "#!/bin/bash\necho 1.0.1\n", { mode: 0o700 });
      await writeFile(
        join(root, "gh"),
        [
          "#!/bin/bash",
          'if [[ "$VOICE_TEST_SCENARIO" == "api-failure" ]]; then exit 1; fi',
          `if [[ "$VOICE_TEST_SCENARIO" == "published" ]]; then echo '[[{"tag_name":"voice-v1.0.1","draft":false}]]'; else echo '[[]]'; fi`,
        ].join("\n"),
        { mode: 0o700 },
      );
      const output = join(root, "output");
      await writeFile(output, "");
      const run = execute("bash", ["-c", step.run], {
        cwd: root,
        env: {
          ...process.env,
          PATH: root + ":" + process.env.PATH,
          GITHUB_OUTPUT: output,
          GITHUB_EVENT_NAME: scenario === "manual-mismatch" ? "workflow_dispatch" : "push",
          GITHUB_REF_TYPE: scenario === "tag-mismatch" ? "tag" : "branch",
          GITHUB_REF_NAME: scenario === "tag-mismatch" ? "voice-v1.0.0" : "main",
          REQUESTED_TAG: scenario === "manual-mismatch" ? "voice-v1.0.0" : "",
          GH_REPO: "example/loop",
          VOICE_TEST_SCENARIO: scenario,
        },
      });
      if (scenario === "new") await run;
      else await expect(run).rejects.toThrow();
      expect(await readFile(output, "utf8")).toBe(
        scenario === "new" ? "release_tag=voice-v1.0.1\n" : "",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test.each(["missing", "draft", "published", "wrong-commit", "api-failure", "upload-failure"])(
  "publication handles %s releases without deleting tags",
  async (scenario) => {
    if (process.platform === "win32") return;
    const workflow = parse(
      await readFile(
        new URL("../../../../../../.github/workflows/voice-native.yml", import.meta.url),
        "utf8",
      ),
    );
    const publish = workflow.jobs.publish.steps.find((step: { run?: string }) => step.run);
    expect(workflow.concurrency.group).toBe("voice-assets-publication");
    const root = await mkdtemp(join(tmpdir(), "voice-publish-"));
    try {
      await mkdir(join(root, "release-assets"));
      for (const name of [
        "engine.tar.gz",
        "model.tar.gz",
        "reviewed-model-assets.json",
        "published-catalog.ts",
        "manifest.json",
      ]) {
        await writeFile(join(root, "release-assets", name), "synthetic");
      }
      await writeFile(
        join(root, "gh"),
        [
          "#!/bin/bash",
          'echo "$*" >> "$VOICE_TEST_LOG"',
          'if [[ "$1" == "api" ]]; then',
          '  if [[ "$VOICE_TEST_SCENARIO" == "api-failure" ]]; then exit 1; fi',
          `  if [[ "$VOICE_TEST_SCENARIO" == "published" ]]; then echo '[[{"tag_name":"voice-v1.0.1","draft":false}]]';`,
          `  elif [[ "$VOICE_TEST_SCENARIO" == "draft" || "$VOICE_TEST_SCENARIO" == "wrong-commit" ]]; then echo '[[{"tag_name":"voice-v1.0.1","draft":true}]]';`,
          `  else echo '[[]]'; fi`,
          "fi",
          'if [[ "$2" == "view" ]]; then',
          '  if [[ "$VOICE_TEST_SCENARIO" == "wrong-commit" ]]; then echo other; else echo synthetic; fi',
          "fi",
          'if [[ "$2" == "upload" && "$VOICE_TEST_SCENARIO" == "upload-failure" ]]; then exit 1; fi',
          "exit 0",
        ].join("\n"),
        { mode: 0o700 },
      );
      const run = execute("bash", ["-c", publish.run], {
        cwd: root,
        env: {
          ...process.env,
          PATH: root + ":" + process.env.PATH,
          GH_TOKEN: "synthetic",
          GITHUB_SHA: "synthetic",
          GH_REPO: "example/loop",
          VOICE_RELEASE_TAG: "voice-v1.0.1",
          VOICE_TEST_LOG: join(root, "calls"),
          VOICE_TEST_SCENARIO: scenario,
        },
      });
      const blocked = ["published", "wrong-commit", "api-failure"].includes(scenario);
      if (scenario === "upload-failure" || blocked) await expect(run).rejects.toThrow();
      else await run;
      const calls = (await readFile(join(root, "calls"), "utf8")).trim().split("\n");
      expect(calls.some((call) => call.startsWith("release create"))).toBe(
        scenario === "missing" || scenario === "upload-failure",
      );
      expect(calls.some((call) => call.startsWith("release delete"))).toBe(false);
      if (blocked) {
        expect(calls.some((call) => call.startsWith("release upload"))).toBe(false);
        expect(calls.some((call) => call.startsWith("release edit"))).toBe(false);
      } else if (scenario === "upload-failure") {
        expect(calls.some((call) => call.startsWith("release edit"))).toBe(false);
      } else {
        expect(calls.at(-2)).toBe("release upload voice-v1.0.1 --clobber -- manifest.json");
        expect(calls.at(-1)).toBe(
          "release edit voice-v1.0.1 --title Loop Voice v1.0.1 — Local speech engine & models --draft=false --latest=false",
        );
        expect(calls.find((call) => call.startsWith("release upload"))).toContain(
          "engine.tar.gz model.tar.gz",
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
