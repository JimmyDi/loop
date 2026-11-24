import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const createUpdateManifest = async (
  directory: string,
  version: string,
  repository: string,
) => {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Invalid desktop release identity");
  const platforms: Record<string, { url: string; signature: string }> = {};
  const targets = {
    "darwin-aarch64": ".app.tar.gz",
    "darwin-x86_64": ".app.tar.gz",
    "windows-x86_64": ".exe",
  };
  for (const [target, extension] of Object.entries(targets)) {
    const files = await readdir(join(directory, target));
    const candidates = files.filter((file) => file.endsWith(extension));
    if (candidates.length !== 1) throw new Error("Expected one update artifact for " + target);
    const file = candidates[0]!;
    const signature = (await readFile(join(directory, target, file + ".sig"), "utf8")).trim();
    if (!signature || !/^[A-Za-z0-9+/=]+$/.test(signature))
      throw new Error("Missing update signature for " + target);
    platforms[target] = {
      url:
        "https://github.com/" +
        repository +
        "/releases/download/desktop-v" +
        version +
        "/" +
        encodeURIComponent(target + "-" + file),
      signature,
    };
  }
  return { version, platforms };
};

if (process.argv[1]?.endsWith("release-manifest.ts")) {
  const [directory, version, repository] = process.argv.slice(2);
  if (!directory || !version || !repository)
    throw new Error("Expected artifacts, version and repository");
  await writeFile(
    join(directory, "stable.json"),
    JSON.stringify(await createUpdateManifest(directory, version, repository), null, 2) + "\n",
  );
}
