import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { staticResponse } from "./static-files";

test("static assets enforce package confinement and support HEAD and missing assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-assets-"));
  const assets = join(root, "web");
  await mkdir(assets);
  await writeFile(join(assets, "index.html"), "<title>Loop</title>");
  await writeFile(join(root, "private.txt"), "private");
  await symlink(join(root, "private.txt"), join(assets, "escape.txt"));
  try {
    const response = await staticResponse(new Request("http://localhost/"), assets);
    expect(await response.text()).toBe("<title>Loop</title>");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect((await staticResponse(new Request("http://localhost/escape.txt"), assets)).status).toBe(
      403,
    );
    expect((await staticResponse(new Request("http://localhost/missing.js"), assets)).status).toBe(
      404,
    );
    expect(
      (await staticResponse(new Request("http://localhost/", { method: "POST" }), assets)).status,
    ).toBe(405);
    expect(
      await (
        await staticResponse(new Request("http://localhost/", { method: "HEAD" }), assets)
      ).text(),
    ).toBe("");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
