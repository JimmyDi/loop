import { readFile, writeFile } from "node:fs/promises";

const { version, name } = JSON.parse(await readFile("package.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const sections = [...changelog.matchAll(/^## (.+)\r?$/gm)];
const release = sections.find((section) => section[1].startsWith(`[${version}] - `));
if (!release) throw new Error("Missing release notes for the package version.");
const next = sections.find((section) => section.index > release.index);
const notes = changelog.slice(release.index + release[0].length, next?.index).trim();
await writeFile(
  "release-notes.md",
  notes +
    `\n\n### Installation\n\n` +
    `npm: \`${name}@${version}\`\n\n` +
    `GitHub Packages: \`${name}@${version}\` (registry: https://npm.pkg.github.com/)\n\n` +
    "The attached loop.tgz is the verified npm package. SHA256SUMS verifies the attachment.\n",
);
