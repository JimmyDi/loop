import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { gunzipSync } from "node:zlib";

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

test("static scripts negotiate gzip without compressing HTML or rejecting identity clients", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".static-gzip-"));
  const source = 'console.log("Synthetic example");'.repeat(300);
  await writeFile(join(root, "script.js"), source);
  await writeFile(join(root, "index.html"), "<p>Synthetic page</p>".repeat(100));
  const get = (path: string, encoding: string, method = "GET") =>
    staticResponse(
      new Request("http://localhost/" + path, { method, headers: { "Accept-Encoding": encoding } }),
      root,
    );
  try {
    const zipped = await get("script.js", "gzip, deflate, br");
    expect(zipped.headers.get("content-encoding")).toBe("gzip");
    expect(zipped.headers.get("vary")).toBe("Accept-Encoding");
    const bytes = Buffer.from(await zipped.arrayBuffer());
    expect(bytes.byteLength).toBeLessThan(source.length / 2);
    expect(gunzipSync(bytes).toString()).toBe(source);
    for (const encoding of ["", "identity", "gzip;q=0, br"]) {
      const response = await get("script.js", encoding);
      expect(response.headers.has("content-encoding")).toBe(false);
      expect(await response.text()).toBe(source);
    }
    expect((await get("", "gzip")).headers.has("content-encoding")).toBe(false);
    const head = await get("script.js", "gzip", "HEAD");
    expect(head.headers.get("content-encoding")).toBe("gzip");
    expect(await head.text()).toBe("");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
