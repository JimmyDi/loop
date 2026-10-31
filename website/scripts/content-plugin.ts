import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Marked } from "marked";
import type { Plugin } from "vite";

import { publicReleaseCatalog, readReleaseCatalog } from "../../scripts/release-content/catalog";
import type { ReleaseContent } from "../../scripts/release-content/types";

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export const renderContent = (markdown: string, source: string, release: ReleaseContent) => {
  const headings: { id: string; title: string }[] = [];
  const parser = new Marked();
  const counts = new Map<string, number>();
  parser.use({
    renderer: {
      html: () => "",
      image: () => "",
      heading({ depth, text, tokens }) {
        const base = text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "");
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        const id = base + (count ? "-" + count : "");
        if (depth === 2 || depth === 3) headings.push({ id, title: text });
        return (
          "<h" +
          depth +
          ' id="' +
          escape(id) +
          '">' +
          this.parser.parseInline(tokens) +
          "</h" +
          depth +
          ">"
        );
      },
      link({ href, tokens }) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) {
          return this.parser.parseInline(tokens);
        }
        if (href.startsWith("//") || href.startsWith("/")) return this.parser.parseInline(tokens);
        let url = href;
        if (!/^(https?:|#)/.test(href)) {
          const [path, hash] = href.split("#");
          const segments = source.split("/").slice(0, -1);
          for (const part of path.split("/")) {
            if (part === "..") segments.pop();
            else if (part !== "." && part) segments.push(part);
          }
          const target = segments.join("/");
          const page = release.pages.find((entry) => entry.source === target);
          url = page
            ? "docs/" + release.version + "/" + page.slug + "/" + (hash ? "#" + hash : "")
            : "https://github.com/JimmyDi/loop/blob/v" +
              release.version +
              "/" +
              target +
              (hash ? "#" + hash : "");
        }
        if (!/^(https?:|#|docs\/)/.test(url)) return this.parser.parseInline(tokens);
        return '<a href="' + escape(url) + '">' + this.parser.parseInline(tokens) + "</a>";
      },
    },
  });
  return { html: parser.parse(markdown, { async: false }), headings };
};

export const contentPlugin = (): Plugin => ({
  name: "released-documentation",
  resolveId(id) {
    if (id === "virtual:release-content") return "\0" + id;
  },
  async load(id) {
    if (id !== "\0virtual:release-content") return;
    const root = resolve(import.meta.dirname, "../..");
    const confirmed = process.env.LOOP_PUBLISHED_VERSIONS;
    if (process.env.CI && !confirmed) throw new Error("CI needs npm-confirmed published versions.");
    const published = JSON.parse(
      confirmed ?? (await readFile(resolve(root, "releases/published.json"), "utf8")),
    );
    const snapshots = await readReleaseCatalog(root);
    const history = JSON.parse(
      await readFile(resolve(root, "releases/history.json"), "utf8"),
    ) as ReleaseContent[];
    const releases = publicReleaseCatalog(
      [
        ...snapshots,
        ...history
          .filter((entry) => !snapshots.some((snapshot) => snapshot.version === entry.version))
          .map((entry) => ({ ...entry, pages: [] })),
      ],
      published,
    );
    if (!releases.length) throw new Error("No published documentation snapshots available.");
    const data = releases.map((release) => ({
      version: release.version,
      date: release.date,
      title: release.title,
      summary: release.summary,
      ...renderContent(release.notes, "CHANGELOG.md", release),
      pages: release.pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        group: page.group,
        ...renderContent(page.markdown, page.source, release),
        search: page.markdown.replace(/[^\p{L}\p{N} ]/gu, " ").toLowerCase(),
      })),
    }));
    // Full articles are already in the static page; browsers need only navigation/search data.
    if (
      this.environment.config.command === "build" &&
      this.environment.config.consumer === "client"
    ) {
      for (const release of data) {
        release.html = "";
        for (const page of release.pages) page.html = "";
      }
    }
    return "export default " + JSON.stringify(data).replaceAll("<", "\u003c") + ";";
  },
});
