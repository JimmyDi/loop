import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { startServer } from "./server";
import { createRemoteAccess } from "./remote-access/create-remote-access";
import { RemoteAccessController } from "./remote-access/controller";

vi.mock("./remote-access/create-remote-access", () => ({ createRemoteAccess: vi.fn() }));

test.each([false, true])(
  "development remote ingress serves built assets (custom directory: %s)",
  async (custom) => {
    const data = await mkdtemp(join(import.meta.dirname, ".server-test-"));
    vi.stubEnv("LOOP_DATA_DIR", data);
    const assets = join(data, "assets");
    let ingress:
      | Awaited<ReturnType<NonNullable<Parameters<typeof createRemoteAccess>[1]>>>
      | undefined;
    vi.mocked(createRemoteAccess).mockImplementation(async (_agentDir, factory) => {
      ingress = await factory!();
      ingress.connected?.("https://example.test");
      return new RemoteAccessController({ supported: false, runtime: vi.fn() });
    });
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      if (custom) {
        await mkdir(assets);
        await writeFile(
          join(assets, "remote.html"),
          '<html><head></head><script src="/entry.js"></script></html>',
        );
        await writeFile(join(assets, "entry.js"), 'console.log("synthetic");');
      }
      server = await startServer(0, { development: true, assetsDir: custom ? assets : undefined });
      expect((await fetch(server.url)).status).toBe(200);
      const remote = "http://127.0.0.1:" + ingress!.port;
      const page = await fetch(remote);
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('<meta name="loop-remote" content="1">');
      expect(html).not.toContain("/@vite/client");
      if (!custom) {
        expect(html).toContain('name="name"');
        expect(html).not.toContain("Loop…");
        expect(html).not.toMatch(/(?:src|href)="[^"]*(?:main-|AppShell-)/);
        const initialScripts = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)];
        let bytes = 0;
        for (const [, script] of initialScripts) {
          const response = await fetch(new URL(script!, remote));
          bytes += (await response.arrayBuffer()).byteLength;
        }
        expect(bytes).toBeLessThan(20_000);
      }
      const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)];
      expect(scripts.length).toBeGreaterThan(0);
      for (const [, script] of scripts) {
        const response = await fetch(new URL(script!, remote));
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("javascript");
        expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
      }
      expect(await (await fetch(remote + "/api/remote-session")).json()).toEqual({
        mode: "remote",
        authorized: false,
      });
      expect((await fetch(remote + "/api/workspaces")).status).toBe(401);
    } finally {
      await ingress?.close();
      await server?.close();
      vi.unstubAllEnvs();
      vi.mocked(createRemoteAccess).mockReset();
      await rm(data, { recursive: true, force: true });
    }
  },
);
