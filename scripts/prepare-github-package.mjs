import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [archive, destination, repository] = process.argv.slice(2);
if (!archive || !destination || !repository || !/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(repository)) {
  throw new Error(
    "Usage: prepare-github-package.mjs <verified-tgz> <output-directory> <owner/repo>",
  );
}

const output = resolve(destination);
const temporary = await mkdtemp(join(output, ".github-package-"));
try {
  execFileSync("tar", ["-xzf", resolve(archive), "-C", temporary]);
  const directory = join(temporary, "package");
  const path = join(directory, "package.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (manifest.name !== "@loop-harness/loop" || manifest.private !== false) {
    throw new Error("Expected the verified public Loop package.");
  }
  manifest.repository = { type: "git", url: `git+https://github.com/${repository}.git` };
  manifest.publishConfig = { registry: "https://npm.pkg.github.com/" };
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
  const result = JSON.parse(
    execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", output], {
      cwd: directory,
      encoding: "utf8",
    }),
  );
  await rename(join(output, result[0].filename), join(output, "github-loop.tgz"));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
