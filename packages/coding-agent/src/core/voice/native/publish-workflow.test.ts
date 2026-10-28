import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { expect, test } from "vitest";

const execute = promisify(execFile);

test.each(["missing", "existing", "upload-failure"])(
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
          'if [[ "$2" == "view" && "$VOICE_TEST_SCENARIO" == "missing" ]]; then exit 1; fi',
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
          VOICE_RELEASE_TAG: "voice-v1.0.0",
          VOICE_TEST_LOG: join(root, "calls"),
          VOICE_TEST_SCENARIO: scenario,
        },
      });
      if (scenario === "upload-failure") await expect(run).rejects.toThrow();
      else await run;
      const calls = (await readFile(join(root, "calls"), "utf8")).trim().split("\n");
      expect(calls.some((call) => call.startsWith("release create"))).toBe(scenario === "missing");
      expect(calls.some((call) => call.startsWith("release delete"))).toBe(false);
      if (scenario === "upload-failure") {
        expect(calls.some((call) => call.startsWith("release edit"))).toBe(false);
      } else {
        expect(calls.at(-2)).toBe("release upload voice-v1.0.0 --clobber -- manifest.json");
        expect(calls.at(-1)).toBe("release edit voice-v1.0.0 --draft=false --latest=false");
        expect(calls.find((call) => call.startsWith("release upload"))).toContain(
          "engine.tar.gz model.tar.gz",
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
