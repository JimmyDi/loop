import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateContent } from "./catalog";
import { createReleaseContent } from "./snapshot";

export const checkReleaseSnapshot = async (root: string, version: string): Promise<void> => {
  const content = validateContent(
    JSON.parse(await readFile(join(root, "releases", version + ".json"), "utf8")),
  );
  if (!content.pages.length) throw new Error("Release documentation is required.");
  const expected = await createReleaseContent(root, version, content.summary);
  if (JSON.stringify(content) !== JSON.stringify(expected)) {
    throw new Error("Release snapshot is stale; regenerate it from the final release source.");
  }
};
