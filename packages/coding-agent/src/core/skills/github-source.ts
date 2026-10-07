import { createBundle, validateBundlePath } from "./bundle";
import type { SkillBundle } from "./bundle";
import { SkillError } from "./types";
import type { SkillPreviewInput, SkillSource } from "./types";

type GitHubTreeEntry = { path: string; mode: string; type: string; sha: string; size?: number };

export const parseGitHubSource = (location: string, ref?: string) => {
  if (location.split("/").some((part) => [".", ".."].includes(decodeURIComponent(part))))
    throw new SkillError("skill_github_url_invalid");
  const url = new URL(location);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new SkillError(
      "skill_github_url_invalid",
      "Use a public github.com repository or folder URL.",
    );
  const parts = url.pathname.replace(/\/$/, "").split("/").slice(1).map(decodeURIComponent);
  const [owner, repo, type, version, ...folder] = parts;
  if (
    !owner ||
    !repo ||
    !/^[a-zA-Z0-9_.-]+$/.test(owner) ||
    !/^[a-zA-Z0-9_.-]+$/.test(repo) ||
    (type && type !== "tree")
  )
    throw new SkillError("skill_github_url_invalid");
  const directory = folder.join("/");
  if (directory) validateBundlePath(directory);
  const revision = ref?.trim() || version;
  if (revision && (revision.length > 200 || revision.includes("\0")))
    throw new SkillError("skill_github_ref_invalid");
  return { owner, repo: repo.replace(/\.git$/, ""), ref: revision, directory };
};

export const readGitHubBundles = async (
  input: SkillPreviewInput,
  signal: AbortSignal,
): Promise<{ bundles: SkillBundle[]; source: SkillSource }> => {
  const source = parseGitHubSource(input.location ?? "", input.ref);
  const base = "https://api.github.com/repos/" + source.owner + "/" + source.repo;
  const get = async (path: string, max = 8 * 1024 * 1024) => {
    const response = await fetch(base + path, {
      signal,
      redirect: "error",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok)
      throw new SkillError(
        "skill_github_unavailable",
        "GitHub download failed (" + response.status + "), retry or add a local folder.",
      );
    if (Number(response.headers.get("content-length")) > max)
      throw new SkillError("skill_bundle_too_large");
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > max) throw new SkillError("skill_bundle_too_large");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const version = source.ref ?? (await get("")).default_branch;
  const commit = await get("/commits/" + encodeURIComponent(version));
  const tree = await get("/git/trees/" + commit.sha + "?recursive=1");
  if (tree.truncated || !Array.isArray(tree.tree))
    throw new SkillError(
      "skill_repository_too_large",
      "Select a smaller repository or add a local folder.",
    );
  const entries = tree.tree as GitHubTreeEntry[];
  const roots = entries
    .filter(
      (entry) =>
        entry.type === "blob" &&
        (entry.path === "SKILL.md" || entry.path.endsWith("/SKILL.md")) &&
        (!source.directory || entry.path.startsWith(source.directory + "/")),
    )
    .map((entry) => entry.path.slice(0, -8));
  if (!roots.length || roots.length > 30)
    throw new SkillError(
      "skill_candidates_invalid",
      "Select a folder containing between 1 and 30 skills.",
    );
  const bundles: SkillBundle[] = [];
  let total = 0;
  for (const root of roots) {
    const children = entries.filter(
      (entry) => entry.type === "blob" && entry.path.startsWith(root),
    );
    if (children.length > 500) throw new SkillError("skill_bundle_too_large");
    const files = new Map<string, Buffer>();
    const executable = new Set<string>();
    for (const entry of children) {
      const relative = entry.path.slice(root.length);
      validateBundlePath(relative);
      if (entry.mode !== "100644" && entry.mode !== "100755")
        throw new SkillError("skill_bundle_symlink");
      total += entry.size ?? 0;
      if (total > 20 * 1024 * 1024) throw new SkillError("skill_bundle_too_large");
      const blob = await get("/git/blobs/" + entry.sha, 30 * 1024 * 1024);
      const content = Buffer.from(blob.content, "base64");
      if (content.length !== entry.size) throw new SkillError("skill_download_invalid");
      files.set(relative, content);
      if (entry.mode === "100755") executable.add(relative);
    }
    bundles.push({ ...createBundle(root || "root", files), executable });
  }
  return {
    bundles,
    source: {
      kind: "github",
      location: "https://github.com/" + source.owner + "/" + source.repo,
      ref: version,
      revision: commit.sha,
      subdirectory: source.directory,
    },
  };
};
