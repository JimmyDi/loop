import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Marked } from "marked";

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export const renderBlogMarkdown = (
  markdown: string,
  slug: string,
  publicRoot: string,
  language = "en",
) => {
  const headings: { id: string; title: string }[] = [];
  const counts = new Map<string, number>();
  const parser = new Marked();
  parser.use({
    renderer: {
      html: () => "",
      heading({ depth, text, tokens }) {
        const base =
          text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-|-$/g, "") || "section";
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
      code({ text, lang }) {
        const label = (lang ?? "text").split(/\s/)[0];
        return (
          "<pre><span data-code-language>" +
          escape(label) +
          '</span><button type="button" data-copy-code>' +
          (language === "zh" ? "复制代码" : "Copy code") +
          "</button><code>" +
          escape(text) +
          "</code></pre>"
        );
      },
      link({ href, tokens }) {
        const label = this.parser.parseInline(tokens);
        if (!/^(https?:\/\/|#|(?:blog|docs|changelog)\/)/i.test(href) || /[\s\\]/.test(href))
          return label;
        return '<a href="' + escape(href) + '">' + label + "</a>";
      },
      image({ href, text }) {
        if (!text.trim() || !/^[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$/i.test(href)) {
          throw new Error("Blog images need alt text and a local raster asset.");
        }
        const directory = resolve(publicRoot, "blog", slug);
        const file = resolve(directory, href);
        if (!file.startsWith(directory + sep) || !existsSync(file))
          throw new Error("Missing or invalid blog image: " + slug);
        return (
          '<button type="button" data-enlarge-image aria-label="' +
          escape((language === "zh" ? "放大图片：" : "Enlarge image: ") + text) +
          '"><img src="blog/' +
          slug +
          "/" +
          escape(href.replace(/^\.\//, "")) +
          '" alt="' +
          escape(text) +
          '" loading="lazy" decoding="async"></button>'
        );
      },
    },
  });
  const html = parser.parse(markdown, { async: false });
  return { html, headings };
};
