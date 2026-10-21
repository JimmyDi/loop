import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { expect, test } from "vitest";

test.each(["index.html", "remote.html"])(
  "%s applies the saved theme before body parsing without application modules",
  async (entry) => {
    const html = await readFile(new URL(entry, import.meta.url), "utf8");
    for (const saved of [
      null,
      '"light"',
      '"dark"',
      '"system"',
      '"invalid"',
      "42",
      "{invalid",
      "unavailable",
    ]) {
      let initial: { theme?: string; body: unknown } | undefined;
      const probe = html.replace(
        "</head>",
        '<script>document.dispatchEvent(new Event("before-body"))</script></head>',
      );
      const dom = new JSDOM(probe, {
        url: "https://example.test",
        runScripts: "dangerously",
        beforeParse(window) {
          Object.defineProperty(window, "localStorage", {
            get: () => {
              if (saved === "unavailable") throw new Error("Storage unavailable");
              return { getItem: () => saved };
            },
          });
          window.document.addEventListener("before-body", () => {
            initial = {
              theme: window.document.documentElement.dataset.theme,
              body: window.document.body,
            };
          });
        },
      });
      try {
        const expected = saved === '"light"' ? "light" : saved === '"dark"' ? "dark" : "system";
        expect(dom.window.document.documentElement.dataset.theme).toBe(expected);
        expect(initial).toEqual({ theme: expected, body: null });
        expect(html.indexOf("data-initial-theme")).toBeLessThan(html.indexOf('type="module"'));
        const style = dom.window.document.querySelector("style[data-initial-theme]")!.textContent!;
        expect(style).toContain("background: light-dark(#f6f7f9, #18191c)");
        expect(style).toContain(':root[data-theme="dark"] { color-scheme: dark; }');
        expect(style).toContain(':root[data-theme="light"] { color-scheme: light; }');
      } finally {
        dom.window.close();
      }
    }
  },
);
