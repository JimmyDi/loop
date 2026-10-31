import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

import {
  applicationReleaseContent,
  readReleaseCatalog,
} from "../../scripts/release-content/catalog";

export const releaseContentPlugin = (): Plugin => ({
  name: "bundled-release-notes",
  resolveId(id) {
    if (id === "virtual:loop-releases") return "\0" + id;
  },
  async load(id) {
    if (id !== "\0virtual:loop-releases") return;
    const root = resolve(import.meta.dirname, "../..");
    const { version } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    const releases = applicationReleaseContent(await readReleaseCatalog(root), version);
    return "export default " + JSON.stringify(releases).replaceAll("<", "\u003c") + ";";
  },
});
