import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateContent } from "./release-content/catalog";
import { createReleaseContent } from "./release-content/snapshot";

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const summary = process.argv[2];
if (!summary) throw new Error('Usage: pnpm release:content "Release highlights"');
const content = validateContent(await createReleaseContent(root, version, summary));
const published: string[] = JSON.parse(
  await readFile(resolve(root, "releases/published.json"), "utf8"),
);
if (published.includes(version))
  throw new Error("Published snapshots are immutable; choose the next version.");
await writeFile(
  resolve(root, "releases", version + ".json"),
  JSON.stringify(content, null, 2) + "\n",
  {
    flag: "w",
  },
);
console.log("Prepared immutable documentation and notes for " + version + ".");
