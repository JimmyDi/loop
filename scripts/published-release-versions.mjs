import { appendFile } from "node:fs/promises";

const response = await fetch("https://registry.npmjs.org/@loop-harness/loop", {
  signal: AbortSignal.timeout(30000),
  headers: { "Cache-Control": "no-cache" },
});
if (!response.ok)
  throw new Error("Cannot verify published releases (HTTP " + response.status + ").");
const manifest = await response.json();
const versions = Object.keys(manifest.versions).filter((version) =>
  /^\d+\.\d+\.\d+$/.test(version),
);
if (!versions.length) throw new Error("No published stable releases found.");
if (process.env.GITHUB_ENV) {
  await appendFile(
    process.env.GITHUB_ENV,
    "LOOP_PUBLISHED_VERSIONS=" + JSON.stringify(versions) + "\n",
  );
} else {
  console.log(JSON.stringify(versions));
}
