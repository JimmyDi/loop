import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { releaseVoicePlatforms } from "./release-assets";
import { voiceWorkflowMatrix } from "./workflow-matrix";

test("workflow defaults to Apple Silicon and maps only selected targets to fixed runners", () => {
  expect(voiceWorkflowMatrix()).toEqual({
    targets: "darwin-arm64",
    matrix: {
      include: [{ target: "darwin-arm64", os: "macos-15" }],
    },
  });
  expect(voiceWorkflowMatrix("linux-x64,win32-x64")).toEqual({
    targets: "linux-x64,win32-x64",
    matrix: {
      include: [
        { target: "linux-x64", os: "ubuntu-22.04" },
        { target: "win32-x64", os: "windows-2022" },
      ],
    },
  });
  expect(voiceWorkflowMatrix(releaseVoicePlatforms.join(",")).matrix.include).toHaveLength(5);
});

test.each([
  "",
  "darwin-arm64,darwin-arm64",
  "unknown",
  "darwin-arm64\nother=value",
  "darwin-arm64;exit 1",
  "$(command)",
])("workflow rejects invalid input before producing matrix or output: %j", (value) => {
  expect(() => voiceWorkflowMatrix(value)).toThrow();
});

test("manual workflow passes selected targets through validated prepare output and quoted environment", async () => {
  const path = fileURLToPath(
    new URL("../../../../../../.github/workflows/voice-native.yml", import.meta.url),
  );
  const workflow = parse(await readFile(path, "utf8"));
  expect(workflow.on.workflow_dispatch.inputs.targets.default).toBe("darwin-arm64");
  const prepare = workflow.jobs.prepare;
  expect(prepare.outputs.matrix).toBe("$" + "{{ steps.targets.outputs.matrix }}");
  const step = prepare.steps.find((item: { id?: string }) => item.id === "targets");
  expect(step.env.VOICE_RELEASE_TARGETS).toBe("$" + "{{ inputs.targets || 'darwin-arm64' }}");
  expect(step.run).toContain("prepare-workflow.ts");
  expect(step.run).not.toContain("inputs.targets");
  expect(workflow.jobs.build.needs).toEqual(["prepare"]);
  expect(workflow.jobs.build.env.MACOSX_DEPLOYMENT_TARGET).toBe("14.0");
  expect(workflow.jobs.build.strategy.matrix).toBe(
    "$" + "{{ fromJSON(needs.prepare.outputs.matrix) }}",
  );
  expect(workflow.jobs.catalog.needs).toEqual(["prepare", "build", "models"]);
  const catalog = workflow.jobs.catalog.steps.find(
    (item: { env?: { VOICE_RELEASE_TARGETS?: string } }) => item.env?.VOICE_RELEASE_TARGETS,
  );
  expect(catalog.env.VOICE_RELEASE_TARGETS).toBe("$" + "{{ needs.prepare.outputs.targets }}");
  expect(catalog.run).toContain('--targets "$VOICE_RELEASE_TARGETS"');
  expect(catalog.run).not.toContain("inputs.");
  expect(catalog.env.VOICE_RELEASE_TAG).toBe("$" + "{{ needs.prepare.outputs.release_tag }}");
  expect(workflow.on.push.branches).toEqual(["main"]);
  expect(workflow.on.push.tags).toEqual(["voice-v*"]);
  expect(workflow.on.push.paths).toContain(
    "packages/coding-agent/src/core/voice/resources/catalog.ts",
  );
  expect(workflow.on.push.paths).toContain(
    "!packages/coding-agent/src/core/voice/native/**/*.test.ts",
  );
  const version = prepare.steps.find((item: { id?: string }) => item.id === "version");
  expect(version.run).toContain('tag="voice-v$version"');
  expect(workflow.jobs.publish.needs).toEqual(["prepare", "catalog"]);
  expect(workflow.jobs.publish.if).toBe("github.event_name == 'push'");
  expect(workflow.permissions.contents).toBe("read");
  expect(workflow.jobs.publish.permissions.contents).toBe("write");
  const publish = workflow.jobs.publish.steps.find(
    (item: { name?: string }) => item.name === "Publish verified voice assets",
  );
  expect(publish.env.VOICE_RELEASE_TAG).toBe("$" + "{{ needs.prepare.outputs.release_tag }}");
  expect(publish.env.GH_TOKEN).toBe("$" + "{{ secrets.VOICE_RELEASE_TOKEN }}");
  expect(publish.run).toContain('if [[ -z "$GH_TOKEN" ]]');
  expect(publish.run).toContain('--target "$GITHUB_SHA"');
  expect(publish.run).toContain("--draft=false --latest=false");
});
