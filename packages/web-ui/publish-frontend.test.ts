import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { buildFrontend } from "./publish-frontend";
import { staticResponse } from "./src/backend/http/static-files";

const release = async (directory: string, version: string) => {
  await mkdir(join(directory, "assets"), { recursive: true });
  await writeFile(
    join(directory, "assets/app-" + version + ".js"),
    "export default '" + version + "'",
  );
  for (const name of ["index.html", "remote.html"])
    await writeFile(
      join(directory, name),
      '<script src="/assets/app-' + version + '.js"></script>',
    );
  await writeFile(join(directory, "sw.js"), version);
};

test("a slow successful build preserves the active frontend and old tabs' assets", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".frontend-test-"));
  const target = join(root, "web");
  const staging = join(root, "staging");
  await release(target, "old");
  let finish!: () => void;
  const building = buildFrontend(staging, target, async (directory) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await release(directory, "new");
  });
  const read = (path: string) => staticResponse(new Request("https://example.test" + path), target);
  try {
    expect(await (await read("/")).text()).toContain("app-old.js");
    expect((await read("/assets/app-old.js")).status).toBe(200);
    finish();
    await building;
    expect(await (await read("/")).text()).toContain("app-new.js");
    expect(await (await read("/remote.html")).text()).toContain("app-new.js");
    for (const path of ["/assets/app-old.js", "/assets/app-new.js"])
      expect((await read(path)).status).toBe(200);
    expect(await readFile(join(target, "sw.js"), "utf8")).toBe("new");
    expect(await readdir(root)).toEqual(["web"]);
  } finally {
    finish();
    await building;
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["build", "incomplete", "collision"])(
  "%s failure preserves the previous entry and cleans staging",
  async (failure) => {
    const root = await mkdtemp(join(import.meta.dirname, ".frontend-test-"));
    const target = join(root, "web");
    await release(target, "old");
    try {
      await expect(
        buildFrontend(join(root, "staging"), target, async (directory) => {
          await release(directory, "new");
          if (failure === "build") throw new Error("Synthetic build failure");
          if (failure === "incomplete") await rm(join(directory, "remote.html"));
          if (failure === "collision")
            await writeFile(join(directory, "assets/app-old.js"), "different content");
        }),
      ).rejects.toThrow();
      expect(await readFile(join(target, "index.html"), "utf8")).toContain("app-old.js");
      expect(await readFile(join(target, "sw.js"), "utf8")).toBe("old");
      expect(await readdir(root)).toEqual(["web"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
