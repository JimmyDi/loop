import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

import { pwaPlugin } from "./pwa-plugin";

test("build emits an installable manifest and self-contained static-only worker", async () => {
  const generate = async (code: string) => {
    const emitted = new Map<string, string>();
    const hook = pwaPlugin().generateBundle as Function;
    await hook.call(
      {
        emitFile: (file: { fileName: string; source: string }) =>
          emitted.set(file.fileName, String(file.source)),
      },
      {},
      {
        "assets/app.js": { type: "chunk", code },
        "index.html": { type: "asset", source: "private shell" },
        "assets/app.js.map": { type: "asset", source: "source map" },
        "assets/appXjs": { type: "asset", source: "invalid extension" },
        "assets/nested/app.js": { type: "asset", source: "nested asset" },
      },
    );
    return emitted;
  };
  const first = await generate("one");
  const manifest = JSON.parse(first.get("manifest.webmanifest")!);
  expect(manifest).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    "192x192",
    "512x512",
  ]);
  const source = first.get("sw.js")!;
  const events: string[] = [];
  runInNewContext(source, { self: { addEventListener: (event: string) => events.push(event) } });
  expect(events).toEqual(["install", "activate", "message", "fetch"]);
  expect(source).toContain('"/assets/app.js"');
  expect(source).toContain('"/loop-icon.png"');
  expect(source).toContain('"/loop-icon-light.png"');
  expect(source).not.toContain('"/assets/appXjs"');
  expect(source).not.toContain('"/assets/nested/app.js"');
  expect(source).not.toContain('"/index.html"');
  expect(source).not.toContain('"/assets/app.js.map"');
  expect((await generate("two")).get("sw.js")).not.toBe(source);
});
