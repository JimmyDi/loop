import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";

import type { SessionRegistry } from "../session-registry";
import { sessionImageRoutes } from "./session-images";

test("session images require a message reference and valid raster bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-images-"));
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const controller = {
    workspaceId: "project",
    snapshot: {
      state: { messages: [{ role: "assistant", content: [{ type: "text", text: "" }] }] },
    },
  };
  const registry = {
    get: vi.fn(async () => controller),
    assertAvailable: vi.fn(),
    projects: { get: vi.fn(async () => ({ cwd: root })) },
  } as unknown as SessionRegistry;
  const route = sessionImageRoutes(registry);
  const call = (path: string, method = "GET") => {
    const url = new URL("http://localhost/api/sessions/example/images");
    url.searchParams.set("path", path);
    return route(new Request(url, { method }), url);
  };
  const reference = (source: string) => {
    controller.snapshot.state.messages[0]!.content[0]!.text = "![Screenshot](<" + source + ">)";
  };
  try {
    await writeFile(join(root, "screen shot.png"), image);
    await expect(call("screen shot.png")).rejects.toMatchObject({ status: 404 });
    reference("screen%20shot.png");
    const response = await call("screen shot.png");
    expect(response!.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response!.arrayBuffer())).toEqual(image);
    expect(await (await call("screen shot.png", "HEAD"))!.text()).toBe("");
    reference(join(root, "screen shot.png"));
    expect((await call(join(root, "screen shot.png")))!.status).toBe(200);
    await writeFile(join(root, "fake.png"), "<html>not an image</html>");
    reference("fake.png");
    await expect(call("fake.png")).rejects.toMatchObject({ status: 404 });
    reference("missing.png");
    await expect(call("missing.png")).rejects.toMatchObject({ status: 404 });
    reference("screen shot.png");
    await expect(call("screen shot.png", "POST")).rejects.toMatchObject({ status: 405 });
    if (process.platform !== "win32") {
      await symlink(process.execPath, join(root, "outside.png"));
      reference("outside.png");
      await expect(call("outside.png")).rejects.toMatchObject({ status: 404 });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
