import { resolve } from "node:path";
import type { Plugin } from "vite";

import { readArticleIndex } from "./blog-index.ts";
import { readBlogContent } from "./blog-content.ts";

export const blogPlugin = (): Plugin => {
  const directory = resolve(import.meta.dirname, "../content/blog");
  const readPosts = () => readBlogContent(directory, resolve(import.meta.dirname, "../public"));
  const modules = ["virtual:blog-content", "virtual:blog-index"];
  return {
    name: "authored-blog",
    resolveId: (id) => (modules.includes(id) ? "\0" + id : undefined),
    async load(id) {
      if (!modules.some((name) => id === "\0" + name)) return;
      const posts = await readPosts();
      const index = await readArticleIndex(directory, posts);
      this.addWatchFile(resolve(directory, "index.jsonl"));
      for (const post of posts) {
        this.addWatchFile(resolve(directory, post.slug + ".zh.md"));
        this.addWatchFile(resolve(directory, post.slug + ".en.md"));
      }
      if (id === "\0virtual:blog-index") {
        return "export default " + JSON.stringify(index).replaceAll("<", "\\u003c") + ";";
      }
      for (const post of posts) {
        if (
          this.environment.config.command === "build" &&
          this.environment.config.consumer === "client"
        ) {
          post.zh.html = "";
          post.en.html = "";
        }
      }
      return "export default " + JSON.stringify(posts).replaceAll("<", "\\u003c") + ";";
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "blog/index.json",
        source: JSON.stringify(await readArticleIndex(directory, await readPosts())),
      });
    },
    configureServer(server) {
      server.watcher.add(directory);
      server.watcher.on("all", (_event, file) => {
        if (!file.startsWith(directory)) return;
        for (const name of modules) {
          const module = server.moduleGraph.getModuleById("\0" + name);
          if (module) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      });
    },
  };
};
