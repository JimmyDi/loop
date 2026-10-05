import { cp, chmod, readdir, readFile, writeFile } from "node:fs/promises";

// Declaration bundling emits source-location regions even with comments disabled.
const output = new URL("../dist/", import.meta.url);
for (const name of await readdir(output)) {
  if (!name.endsWith(".d.ts")) continue;
  const file = new URL(name, output);
  const text = await readFile(file, "utf8");
  await writeFile(file, text.replace(/^\s*\/\/#(?:end)?region\b[^\r\n]*\r?\n/gm, ""));
}

await cp(
  new URL("../packages/web-ui/dist/web/", import.meta.url),
  new URL("../dist/web/", import.meta.url),
  { recursive: true },
);
await chmod(new URL("../dist/bin.js", import.meta.url), 0o755);

await cp(
  new URL("../packages/web-ui/src/docs/assets/loop-brand/BRAND-ASSETS.md", import.meta.url),
  new URL("../dist/web/BRAND-ASSETS.md", import.meta.url),
);
