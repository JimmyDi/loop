import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { expect, test } from "vitest";

test("website rebuilds after successful release and verifies publication before public builds", async () => {
  const workflow = parse(
    await readFile(new URL("../.github/workflows/website.yml", import.meta.url), "utf8"),
  );
  expect(workflow.on.workflow_run.workflows).toEqual(["Release"]);
  expect(workflow.jobs.build.if).toContain("conclusion == 'success'");
  const steps = workflow.jobs.build.steps;
  const verify = steps.findIndex(
    (step: { run?: string }) => step.run === "node scripts/published-release-versions.mjs",
  );
  const build = steps.findIndex((step: { run?: string }) => step.run?.includes("build --base"));
  expect(verify).toBeGreaterThan(-1);
  expect(build).toBeGreaterThan(verify);
  expect(workflow.jobs.deploy.if).toContain("github.event_name != 'pull_request'");
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
});
