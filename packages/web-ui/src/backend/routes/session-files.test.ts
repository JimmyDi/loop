import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { expect, test, vi } from "vitest";

import type { SessionRegistry } from "../session-registry";
import { sessionFileRoutes } from "./session-files";

test("session files download safely and support media byte ranges and PDF previews", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-files-"));
  const state = {
    messages: [{ role: "assistant", content: [{ type: "text", text: "" }] }],
    draft: undefined as { role: string; content: { type: string; text: string }[] } | undefined,
  };
  const registry = {
    get: vi.fn(async () => ({ workspaceId: "project", snapshot: { state } })),
    assertAvailable: vi.fn(),
    projects: { get: vi.fn(async () => ({ cwd: root })) },
  } as unknown as SessionRegistry;
  const route = sessionFileRoutes(registry);
  const reference = (path: string) => {
    state.messages[0]!.content[0]!.text = "[File](<" + path + ">)";
  };
  const call = (path: string, preview = false, method = "GET", range?: string) => {
    const url = new URL("http://localhost/api/sessions/example/files");
    url.searchParams.set("path", path);
    if (preview) url.searchParams.set("preview", "1");
    return route(new Request(url, { method, headers: range ? { Range: range } : {} }), url);
  };
  try {
    await writeFile(join(root, "movie.mp4"), "0123456789");
    await expect(call("movie.mp4")).rejects.toMatchObject({ status: 404 });
    reference("movie.mp4");
    const download = (await call("movie.mp4"))!;
    expect(download.headers.get("content-disposition")).toContain("attachment;");
    expect(download.headers.get("content-type")).toBe("application/octet-stream");
    expect(await download.text()).toBe("0123456789");
    for (const [range, content, bounds] of [
      ["bytes=2-5", "2345", "2-5"],
      ["bytes=-3", "789", "7-9"],
      ["bytes=8-", "89", "8-9"],
      ["bytes=8-99", "89", "8-9"],
    ]) {
      const response = (await call("movie.mp4", true, "GET", range))!;
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe("bytes " + bounds + "/10");
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(await response.text()).toBe(content);
    }
    for (const range of ["bytes=20-", "bytes=4-2", "bytes=-0", "bytes=1-2,4-5", "invalid"]) {
      const response = (await call("movie.mp4", true, "GET", range))!;
      expect(response.status).toBe(416);
      expect(response.headers.get("content-range")).toBe("bytes */10");
    }
    const head = (await call("movie.mp4", true, "HEAD"))!;
    expect(head.headers.get("content-length")).toBe("10");
    expect(await head.text()).toBe("");
    await expect(call("movie.mp4", false, "POST")).rejects.toMatchObject({ status: 405 });
    await writeFile(join(root, "report.pdf"), "%PDF-1.7 synthetic fixture");
    reference("report.pdf");
    const pdf = (await call("report.pdf", true))!;
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("inline;");
    await pdf.text();
    await writeFile(join(root, "fake.pdf"), "<script>unsafe</script>");
    reference("fake.pdf");
    await expect(call("fake.pdf", true)).rejects.toMatchObject({ status: 404 });
    const fake = (await call("fake.pdf"))!;
    expect(fake.headers.get("content-type")).toBe("application/octet-stream");
    await fake.text();
    await writeFile(join(root, "page.html"), "<script>unsafe</script>");
    reference("page.html");
    const html = (await call("page.html", true))!;
    expect(html.headers.get("content-disposition")).toContain("attachment;");
    expect(html.headers.get("x-content-type-options")).toBe("nosniff");
    await html.text();
    reference("missing.zip");
    await expect(call("missing.zip")).rejects.toMatchObject({ status: 404 });
    await mkdir(join(root, "directory"));
    reference("directory");
    await expect(call("directory")).rejects.toMatchObject({ status: 404 });
    if (process.platform !== "win32") {
      await symlink(parse(root).root, join(root, "outside"));
      reference("outside/etc/hosts");
      await expect(call("outside/etc/hosts")).rejects.toMatchObject({ status: 404 });
    }
    state.messages[0]!.role = "user";
    reference("movie.mp4");
    await expect(call("movie.mp4")).rejects.toMatchObject({ status: 404 });
    state.draft = { role: "assistant", content: [{ type: "text", text: "[Movie](movie.mp4)" }] };
    const draft = (await call("movie.mp4"))!;
    expect(await draft.text()).toBe("0123456789");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
