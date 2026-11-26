import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export const inlineHomepageStyles = async (html, dist, base) => {
  const link = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
  if (!link) throw new Error("Homepage stylesheet is missing from the client build.");
  const stylesheet = new URL(link[1], "https://build.invalid/");
  let css = await readFile(new URL("assets/" + basename(stylesheet.pathname), dist), "utf8");
  if (base === "./") {
    // Inline CSS resolves relative to the document instead of the external stylesheet.
    css = css.replace(
      /url\((['"]?)(\.\.?\/[^)'"]+)\1\)/g,
      (_, quote, path) =>
        "url(" + quote + "./" + new URL(path, stylesheet).pathname.slice(1) + quote + ")",
    );
  }
  return html.replace(link[0], () => "<style>" + css + "</style>");
};
