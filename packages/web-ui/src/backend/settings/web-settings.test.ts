import { join } from "node:path";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { WebSettings } from "./web-settings";

test("Web defaults use the configured fallback and persist ordered changes independently", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".settings-test-"));
  const file = join(root, "web-ui", "settings.json");
  const settings = new WebSettings(root);
  try {
    expect(await settings.read()).toEqual({ permissionPreset: "read-only" });
    expect(await existsSync(file)).toBe(false);
    await writeFile(
      join(root, "settings.json"),
      JSON.stringify({
        provider: "example",
        model: "example",
        permissionPreset: "workspace-write",
      }),
    );
    expect(await settings.read()).toEqual({ permissionPreset: "workspace-write" });
    const first = settings.save("danger-full-access");
    const second = settings.save("read-only");
    expect(await settings.read()).toEqual({ permissionPreset: "read-only" });
    expect(await first).toEqual({ permissionPreset: "danger-full-access" });
    expect(await second).toEqual({ permissionPreset: "read-only" });
    expect(await new WebSettings(root).read()).toEqual({ permissionPreset: "read-only" });
    expect(
      (await readFile(join(root, "settings.json"), "utf8").then(JSON.parse)).permissionPreset,
    ).toBe("workspace-write");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(join(root, "web-ui"))).toEqual(["settings.json"]);
    await writeFile(file, JSON.stringify({ permissionPreset: "unknown" }));
    await expect(settings.read()).rejects.toThrow("Invalid Web permission defaults");
    await writeFile(file, "{");
    await expect(settings.read()).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed atomic write reports failure and a later valid save can recover", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".settings-failure-"));
  const file = join(root, "web-ui", "settings.json");
  const settings = new WebSettings(root);
  try {
    await mkdir(file, { recursive: true });
    await writeFile(join(file, "sentinel"), "unchanged");
    await expect(settings.save("danger-full-access")).rejects.toThrow();
    expect(await readFile(join(file, "sentinel"), "utf8")).toBe("unchanged");
    expect(await readdir(join(root, "web-ui"))).toEqual(["settings.json"]);
    await rm(file, { recursive: true });
    expect(await settings.save("workspace-write")).toEqual({ permissionPreset: "workspace-write" });
    expect(await settings.read()).toEqual({ permissionPreset: "workspace-write" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
