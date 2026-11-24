import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

test("npm distribution excludes desktop runtime dependencies and build output", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const desktop = JSON.parse(
    await readFile(resolve(root, "packages/desktop/package.json"), "utf8"),
  );
  expect(desktop.private).toBe(true);
  expect(
    Object.keys(manifest.dependencies).some((name) => /tauri|desktop|electron/.test(name)),
  ).toBe(false);
  expect(manifest.files).toEqual(["dist", "README.md", "LICENSE", "CHANGELOG.md"]);
  expect(manifest.scripts.build).toContain("--filter @loop/web-ui...");
  expect(manifest.scripts.build).not.toContain("./packages/*");
  for (const entry of ["bin.ts", "sdk.ts", "tsdown.config.ts"])
    expect(await readFile(resolve(root, entry), "utf8")).not.toMatch(/@loop\/desktop|tauri/);
  const config = JSON.parse(
    await readFile(resolve(root, "packages/desktop/src-tauri/tauri.conf.json"), "utf8"),
  );
  expect(config.version).toBe("../../../package.json");
  expect(config.plugins.updater).toEqual({ pubkey: "", endpoints: [] });
});

test("desktop launch preserves the Web data root and isolates only desktop state", async () => {
  const native = await readFile(resolve(root, "packages/desktop/src-tauri/src/backend.rs"), "utf8");
  expect(native).toContain('.env("LOOP_DESKTOP_STATE_DIR", &data)');
  expect(native).not.toContain('.env("LOOP_DATA_DIR", data.join("data"))');
  expect(native).not.toContain(".current_dir(&data)");
  const main = await readFile(resolve(root, "packages/desktop/src-tauri/src/main.rs"), "utf8");
  expect(main).toContain('smoke.then(|| data.join("data"))');
});

test("native development watching excludes JavaScript development infrastructure", async () => {
  const entry = await readFile(resolve(root, "packages/desktop/scripts/dev.ts"), "utf8");
  expect(entry).not.toContain("additionalWatchFolders");
});
