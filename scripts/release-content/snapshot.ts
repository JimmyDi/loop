import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { changelogReleases } from "./changelog";
import type { DocumentationPage, ReleaseContent } from "./types";

const topics = [
  ["packages/web-ui/src/frontend/docs", "Using Loop", "web"],
  ["packages/coding-agent/src/docs", "Configuration and SDK", "coding-agent"],
  ["packages/agent/src/docs", "Agent API", "agent"],
  ["packages/web-ui/src/backend/docs", "Server reference", "server"],
  ["packages/telemetry/src/docs", "Diagnostics", "telemetry"],
] as const;

export const createReleaseContent = async (
  sourceRoot: string,
  version: string,
  summary: string,
): Promise<ReleaseContent> => {
  const manifest = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  if (manifest.version !== version)
    throw new Error("Snapshot must match the source package version.");
  const release = changelogReleases(await readFile(join(sourceRoot, "CHANGELOG.md"), "utf8")).find(
    (entry) => entry.version === version,
  );
  if (!release || !summary.trim())
    throw new Error("Dated release notes and a summary are required.");
  const pages: DocumentationPage[] = [];
  const add = async (source: string, slug: string, group: string) => {
    const markdown = await readFile(join(sourceRoot, source), "utf8");
    const title = markdown.match(/^# (.+)\r?$/m)?.[1];
    if (!title) throw new Error("Documentation needs a title: " + source);
    pages.push({ slug, title, group, source, markdown });
  };
  await add("README.md", "getting-started", "Start here");
  await add("packages/web-ui/src/frontend/README.md", "web", "Using Loop");
  await add("packages/coding-agent/README.md", "coding-agent", "Configuration and SDK");
  await add("packages/agent/README.md", "agent", "Agent API");
  await add("docs/development.md", "development", "Development");
  for (const [directory, group, prefix] of topics) {
    let names: string[];
    try {
      names = await readdir(join(sourceRoot, directory));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const name of names.sort()) {
      if (name.endsWith(".md"))
        await add(directory + "/" + name, prefix + "/" + name.slice(0, -3), group);
    }
  }
  return { schemaVersion: 1, ...release, title: "Loop " + version, summary: summary.trim(), pages };
};
