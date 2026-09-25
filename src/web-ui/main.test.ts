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
