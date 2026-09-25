import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

test("Markdown sanitizer rejects scripts and unsafe links, retaining tables and math", async () => {
  // DOMPurify requires a supported DOM implementation for sanitizer assertions.
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderMarkdown } = await import("./markdown");
    const html = renderMarkdown(
      "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n| A |\n| - |\n| B |\n\n$$x^2$$",
      "Copy",
      "Table",
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("markdown-table-scroll");
    expect(html).toContain("katex");
  } finally {
    Object.assign(globalThis, previous);
    window.close();
  }
});
