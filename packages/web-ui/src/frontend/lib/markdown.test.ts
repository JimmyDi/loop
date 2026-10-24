import { expect, test } from "vitest";
import { JSDOM } from "jsdom";

test("Markdown sanitizer rejects scripts and unsafe links, retaining tables and math", async () => {
  // DOMPurify requires a supported DOM implementation for sanitizer assertions.
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderMarkdown } = await import("./markdown");
    const { mathParser } = await import("./markdown-math");
    const html = renderMarkdown(
      "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n| A |\n| - |\n| B |\n\n$$x^2$$",
      "Copy",
      "Table",
      { math: mathParser },
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("markdown-table-scroll");
    expect(html).toContain("katex");
    const images = renderMarkdown(
      "![Local](<file:///tmp/screen%20shot.png>)\n\n![Relative](shots/result.png)\n\n![Remote](https://example.test/image.png)",
      "Copy",
      "Table",
      {},
      "session-one",
    );
    const root = window.document.createElement("div");
    root.innerHTML = images;
    expect([...root.querySelectorAll("img")].map((image) => image.getAttribute("src"))).toEqual([
      "/api/sessions/session-one/images?path=%2Ftmp%2Fscreen%20shot.png",
      "/api/sessions/session-one/images?path=shots%2Fresult.png",
      "https://example.test/image.png",
    ]);
    root.innerHTML = renderMarkdown(
      '[PDF](artifacts/report.pdf)\n\n[Video](<movie%20clip.mp4>)\n\n[Website](https://example.test)\n\n<a data-session-file="true" href="https://other.test">Other</a>',
      "Copy",
      "Table",
      {},
      "session-one",
    );
    expect(
      [...root.querySelectorAll("a[data-session-file]")].map((a) => a.getAttribute("href")),
    ).toEqual([
      "/api/sessions/session-one/files?path=artifacts%2Freport.pdf",
      "/api/sessions/session-one/files?path=movie%20clip.mp4",
    ]);
    expect(root.querySelector('a[href="https://example.test"]')!.getAttribute("target")).toBe(
      "_blank",
    );
  } finally {
    Object.assign(globalThis, previous);
    window.close();
  }
});
