import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

test("help works without loading frontend dependencies or starting a server", async () => {
  const child = Bun.spawn([process.execPath, import.meta.dir + "/main.ts", "--help"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(await new Response(child.stdout).text()).toContain("--no-open");
  expect(await new Response(child.stderr).text()).toBe("");
  expect(await child.exited).toBe(0);
});

test("development startup serves HTML, bundled assets and API before announcing readiness", async () => {
  const data = await mkdtemp(join(import.meta.dir, ".startup-test-"));
  const child = Bun.spawn([process.execPath, "main.ts", "--port", "0", "--no-open"], {
    cwd: import.meta.dir,
    env: { ...process.env, NODE_ENV: "development", LOOP_DATA_DIR: data },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
  const errors = new Response(child.stderr).text();

  try {
    let output = "";
    let url: string | undefined;
    const reader = child.stdout.getReader();

    try {
      while (!url) {
        const { done, value } = await reader.read();

        if (done) break;

        output += new TextDecoder().decode(value);
        url = output.match(/Loop Web: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
      }
    } finally {
      reader.releaseLock();
    }

    expect(url).toBeDefined();
    const response = await fetch(url!);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<title>Loop</title>");
    const icons = [...html.matchAll(/<link[^>]*rel="icon"[^>]*href="([^"]+)"[^>]*>/g)];
    expect(icons).toHaveLength(3);
    for (const [, icon] of icons) {
      const resource = await fetch(new URL(icon!, url));
      expect(resource.status).toBe(200);
      expect((await resource.arrayBuffer()).byteLength).toBeGreaterThan(0);
    }
    for (const [rel, name, type] of [
      ["apple-touch-icon", "loop-apple-touch-icon.png", "image/png"],
      ["mask-icon", "loop-mask-icon.svg", "image/svg+xml"],
    ]) {
      const link = html.match(new RegExp('<link[^>]*rel="' + rel + '"[^>]*href="([^"]+)"'));
      expect(link).not.toBeNull();
      const resource = await fetch(new URL(link![1]!, url));
      expect(resource.status).toBe(200);
      expect(resource.headers.get("content-type")).toContain(type!);
      if (rel === "mask-icon") expect(resource.headers.get("cache-control")).toBe("no-cache");
      expect(new Uint8Array(await resource.arrayBuffer())).toEqual(
        new Uint8Array(
          await Bun.file(join(import.meta.dir, "frontend/assets", name!)).arrayBuffer(),
        ),
      );
    }
    const touchFallback = await fetch(new URL("apple-touch-icon.png", url));
    expect(touchFallback.status).toBe(200);
    expect(touchFallback.headers.get("content-type")).toBe("image/png");
    expect(touchFallback.headers.get("cache-control")).toBe("no-cache");
    expect(new Uint8Array(await touchFallback.arrayBuffer())).toEqual(
      new Uint8Array(
        await Bun.file(
          join(import.meta.dir, "frontend/assets/loop-apple-touch-icon.png"),
        ).arrayBuffer(),
      ),
    );
    const fallback = await fetch(new URL("favicon.ico", url));
    expect(fallback.status).toBe(200);
    expect(fallback.headers.get("content-type")).toBe("image/x-icon");
    expect(fallback.headers.get("cache-control")).toBe("no-cache");
    const fallbackBytes = new Uint8Array(await fallback.arrayBuffer());
    expect(fallbackBytes.slice(0, 6)).toEqual(new Uint8Array([0, 0, 1, 0, 4, 0]));
    expect(fallbackBytes).toEqual(
      new Uint8Array(
        await Bun.file(join(import.meta.dir, "frontend/assets/loop-icon.ico")).arrayBuffer(),
      ),
    );
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];

    expect(assets.length).toBeGreaterThan(0);

    for (const [, asset] of assets) {
      const resource = await fetch(new URL(asset!, url));

      expect(resource.status).toBe(200);
      expect((await resource.arrayBuffer()).byteLength).toBeGreaterThan(0);
    }

    const projects = await fetch(new URL("api/workspaces", url));

    expect(await projects.json()).toEqual([]);
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
    expect(await errors).not.toContain("error:");
  } finally {
    clearTimeout(timeout);
    child.kill();
    await child.exited;
    await rm(data, { recursive: true, force: true });
  }
}, 15000);
