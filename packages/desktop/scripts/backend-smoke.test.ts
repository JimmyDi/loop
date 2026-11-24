import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "../../..");

test("desktop workflow builds native installers and publishes only after matching npm release", async () => {
  const source = await readFile(resolve(root, ".github/workflows/desktop.yml"), "utf8");
  const workflow = YAML.parse(source);
  expect(workflow.on.workflow_run.workflows).toEqual(["Release"]);
  expect(
    workflow.jobs.build.strategy.matrix.include.map((item: { target: string }) => item.target),
  ).toEqual(["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
  expect(workflow.jobs.publish.needs).toBe("build");
  expect(workflow.jobs.publish.if).toBe("github.event_name == 'workflow_run'");
  expect(source).toContain("github.event.workflow_run.head_sha");
  expect(source).toContain("packages/desktop/scripts/app-smoke.ts");
});
