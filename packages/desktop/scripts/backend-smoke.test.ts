import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "../../..");

test("desktop shares npm tag release gates and publishes after all native builds", async () => {
  const source = await readFile(resolve(root, ".github/workflows/desktop.yml"), "utf8");
  const workflow = YAML.parse(source);
  const release = YAML.parse(
    await readFile(resolve(root, ".github/workflows/release.yml"), "utf8"),
  );
  expect(Object.keys(workflow.on)).toEqual(["workflow_call", "workflow_dispatch"]);
  expect(workflow.jobs.publish.if).toBe("github.event_name != 'workflow_dispatch'");
  const releaseBuild = workflow.jobs.build.steps.find(
    (step: { name?: string }) =>
      step.name === "Build release installer without platform certificates",
  );
  expect(releaseBuild.if).toBe("github.event_name != 'workflow_dispatch'");
  expect(releaseBuild.run).toBe(
    "pnpm exec tsx scripts/bundle-release.ts ${{ matrix.bundles }} --no-platform-signing",
  );
  expect(Object.keys(releaseBuild.env)).toEqual([
    "LOOP_UPDATER_URL",
    "LOOP_UPDATER_PUBLIC_KEY",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ]);
  expect(
    workflow.jobs.build.steps.find(
      (step: { name?: string }) => step.name === "Build unsigned test installer",
    ),
  ).toMatchObject({ if: "github.event_name == 'workflow_dispatch'" });
  expect(release.on).toEqual({ push: { tags: ["v[0-9]*"] } });
  expect(release.jobs.desktop).toEqual({
    needs: "github-release",
    permissions: { contents: "write" },
    uses: "./.github/workflows/desktop.yml",
    secrets: "inherit",
  });
  expect(release.jobs["github-release"].needs).toBe("publish");
  expect(release.jobs.publish.needs).toBe("verify");
  expect(release.jobs.verify.needs).toBe("validate");
  expect(release.jobs.validate.steps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ run: "git merge-base --is-ancestor HEAD origin/main" }),
      expect.objectContaining({ run: "node scripts/check-release.mjs" }),
    ]),
  );
  expect(
    workflow.jobs.build.strategy.matrix.include.map((item: { target: string }) => item.target),
  ).toEqual(["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
  expect(workflow.jobs.publish.needs).toBe("build");
  expect(source).not.toContain("workflow_run");
  expect(workflow.jobs.publish.steps.at(-1).env.DESKTOP_COMMIT).toBe("${{ github.sha }}");
  expect(source).toContain("packages/desktop/scripts/app-smoke.ts");
});
