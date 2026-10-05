import { readFile } from "node:fs/promises";

import { validateRelease } from "./release.ts";

if (process.env.GITHUB_REF_TYPE !== "tag") throw new Error("Releases require a tag push.");

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");

validateRelease(
  manifest,
  changelog,
  process.env.GITHUB_REF_NAME ?? "",
  process.env.GITHUB_REPOSITORY ?? "",
);

const response = await fetch(
  `https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${manifest.version}`,
  { signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } },
);

if (response.ok) throw new Error("This npm version already exists; choose a new release version.");
if (response.status !== 404)
  throw new Error(`Cannot confirm npm version availability (HTTP ${response.status}).`);

console.log(`Release metadata validated for ${manifest.name}@${manifest.version}.`);
