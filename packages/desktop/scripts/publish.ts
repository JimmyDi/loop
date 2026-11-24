import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { createUpdateManifest } from "./release-manifest";

const root = resolve(import.meta.dirname, "../../..");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const repository = process.env.GH_REPO;
const commit = process.env.DESKTOP_COMMIT;
if (!repository || !commit || !/^[a-f0-9]{40}$/.test(commit))
  throw new Error("Release repository and commit required");
const npm = await fetch("https://registry.npmjs.org/@loop-harness%2Floop/" + version);
if (!npm.ok || (await npm.json()).version !== version)
  throw new Error("Matching npm release is unavailable");
const artifacts = join(root, "packages/desktop/.tools/artifacts");
const manifest = await createUpdateManifest(artifacts, version, repository);
const upload = join(root, "packages/desktop/.tools/upload");
await mkdir(upload, { recursive: true });
const hashes: string[] = [];
for (const target of Object.keys(manifest.platforms)) {
  for (const file of await readdir(join(artifacts, target))) {
    const name = target + "-" + file;
    await cp(join(artifacts, target, file), join(upload, name));
    hashes.push(
      createHash("sha256")
        .update(await readFile(join(upload, name)))
        .digest("hex") +
        "  " +
        name,
    );
  }
}
await writeFile(join(upload, "SHA256SUMS"), hashes.join("\n") + "\n");
await writeFile(join(upload, "stable.json"), JSON.stringify(manifest, null, 2) + "\n");
const existing = (tag: string): { isDraft: boolean; targetCommitish: string } | undefined => {
  try {
    return JSON.parse(
      execFileSync("gh", ["release", "view", tag, "--json", "isDraft,targetCommitish"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return undefined;
  }
};
const gh = (args: string[]) => execFileSync("gh", args, { cwd: upload, stdio: "inherit" });
const tag = "desktop-v" + version;
const previous = existing(tag);
if (previous && previous.targetCommitish !== commit)
  throw new Error("Desktop release belongs to another commit");
if (!previous)
  gh([
    "release",
    "create",
    tag,
    "--target",
    commit,
    "--draft",
    "--title",
    "Loop Desktop " + version,
    "--notes",
    "Desktop distribution of Loop " + version,
  ]);
if (!previous || previous.isDraft) {
  gh(["release", "upload", tag, ...(await readdir(upload)), "--clobber"]);
  gh(["release", "edit", tag, "--draft=false", "--latest=false"]);
} else {
  const response = await fetch(
    "https://github.com/" + repository + "/releases/download/" + tag + "/stable.json",
  );
  if (!response.ok) throw new Error("Published update manifest unavailable");
  const published = await response.json();
  if (
    published.version !== version ||
    JSON.stringify(Object.keys(published.platforms).sort()) !==
      JSON.stringify(Object.keys(manifest.platforms).sort())
  )
    throw new Error("Published update manifest differs");
  await writeFile(join(upload, "stable.json"), JSON.stringify(published, null, 2));
}
const outgoing = JSON.parse(await readFile(join(upload, "stable.json"), "utf8")) as {
  platforms: Record<string, { url: string }>;
};
for (const entry of Object.values(outgoing.platforms)) {
  const response = await fetch(entry.url, { method: "HEAD" });
  if (!response.ok) throw new Error("Published desktop artifact is unavailable");
}
try {
  execFileSync("gh", ["release", "view", "desktop-stable"], { stdio: "ignore" });
} catch {
  gh([
    "release",
    "create",
    "desktop-stable",
    "--target",
    commit,
    "--title",
    "Desktop stable channel",
    "--notes",
    "Signed desktop update manifest",
    "--latest=false",
  ]);
}
const channel = await fetch(
  "https://github.com/" + repository + "/releases/download/desktop-stable/stable.json",
);
if (channel.ok) {
  const current = (await channel.json()).version;
  if (typeof current !== "string" || !/^\d+\.\d+\.\d+$/.test(current))
    throw new Error("Invalid stable channel version");
  const a = current.split(".").map(Number);
  const b = version.split(".").map(Number);
  const difference = a.findIndex((value: number, index: number) => value !== b[index]);
  if (difference >= 0 && a[difference] > b[difference])
    throw new Error("Refusing to downgrade desktop stable channel");
} else if (channel.status !== 404) throw new Error("Stable channel could not be read");
gh(["release", "upload", "desktop-stable", "stable.json", "--clobber"]);
