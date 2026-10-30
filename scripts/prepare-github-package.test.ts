import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("GitHub packaging preserves the verified payload and only changes registry metadata", async () => {
  if (process.platform === "win32") return;
  const root = await mkdtemp(join(tmpdir(), "loop-github-package-"));
  try {
    const source = join(root, "package");
    await mkdir(join(source, "dist"), { recursive: true });
    const manifest = {
      name: "@loop-harness/loop",
      version: "0.5.0",
      private: false,
      type: "module",
      files: ["dist"],
      bin: { loop: "./dist/bin.js" },
      exports: { ".": "./dist/sdk.js" },
      dependencies: { yaml: "^2.9.1" },
      scripts: { prepack: "exit 1" },
      publishConfig: { registry: "https://registry.npmjs.org/", access: "public" },
    };
    await writeFile(join(source, "package.json"), JSON.stringify(manifest));
    await writeFile(join(source, "dist/bin.js"), "#!/usr/bin/env node\nconsole.log('Loop');\n");
    await writeFile(join(source, "dist/sdk.js"), "export const value = 42;\n");
    const archive = join(root, "verified.tgz");
    execFileSync("tar", ["-czf", archive, "-C", root, "package"]);
    const before = await readFile(archive);
    execFileSync(process.execPath, [
      fileURLToPath(new URL("./prepare-github-package.mjs", import.meta.url)),
      archive,
      root,
      "Example/loop",
    ]);
    expect(await readFile(archive)).toEqual(before);
    const unpacked = join(root, "unpacked");
    await mkdir(unpacked);
    execFileSync("tar", ["-xzf", join(root, "github-loop.tgz"), "-C", unpacked]);
    const prepared = join(unpacked, "package");
    expect(JSON.parse(await readFile(join(prepared, "package.json"), "utf8"))).toEqual({
      ...manifest,
      repository: { type: "git", url: "git+https://github.com/Example/loop.git" },
      publishConfig: { registry: "https://npm.pkg.github.com/" },
    });
    for (const file of ["bin.js", "sdk.js"]) {
      expect(await readFile(join(prepared, "dist", file))).toEqual(
        await readFile(join(source, "dist", file)),
      );
    }
    expect((await readdir(root)).some((name) => name.startsWith(".github-package-"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
