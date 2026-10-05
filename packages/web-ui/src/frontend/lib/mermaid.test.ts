import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

// Isolate Mermaid's DOM singleton from other tests' happy-dom/SSR environments.
test("Mermaid renders sanitized diagrams, serializes themes and recovers from failures", () => {
  const result = spawnProcessSync(
    [
      process.execPath,
      "--conditions=loop-source",
      "--import",
      import.meta.resolve("tsx"),
      "--eval",
      `
        import { expect } from "expect";
        import { JSDOM } from "jsdom";
        const { window } = new JSDOM("<!doctype html><html><body></body></html>");
        Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser, CSSStyleSheet: window.CSSStyleSheet });
        // JSDOM has no SVG layout; approximate measurement only, not visual verification.
        window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 20 });
        window.SVGElement.prototype.getComputedTextLength = () => 100;
        const { renderMermaid } = await import("./mermaid.ts");
        const signal = new AbortController().signal;
        const sources = [
          "flowchart LR\\n A[Start] --> B[End]",
          "sequenceDiagram\\n Alice->>Bob: Hello",
          "classDiagram\\n Animal <|-- Duck",
        ];
        try {
          const diagrams = await Promise.all(sources.map((source, index) => renderMermaid(source, index === 1, signal)));
          const ids = [];
          for (const svg of diagrams) {
            const root = window.document.createElement("div");
            root.innerHTML = svg;
            expect(root.querySelector("svg")).not.toBeNull();
            expect(root.querySelector("script, foreignObject, a")).toBeNull();
            ids.push(root.querySelector("svg").id);
          }
          expect(new Set(ids).size).toBe(3);
          expect(diagrams[0]).toContain("Start");
          expect(diagrams[1]).toContain("Hello");
          expect(diagrams[2]).toContain("Animal");
          const dark = await renderMermaid(sources[0], true, signal);
          expect(dark.replaceAll(/loop-mermaid-\\d+/g, "diagram")).not.toBe(diagrams[0].replaceAll(/loop-mermaid-\\d+/g, "diagram"));
          const { default: mermaid } = await import("mermaid");
          expect(mermaid.mermaidAPI.getConfig().theme).toBe("dark");
          const hostile = [
            "---",
            "config:",
            "  securityLevel: loose",
            "  htmlLabels: true",
            "  theme: forest",
            "  suppressErrorRendering: false",
            "---",
            "flowchart LR",
            ' A["<img src=x onerror=alert(1)>"] --> B[Safe]',
            ' click B "javascript:alert(1)"',
          ].join("\\n");
          const safe = await renderMermaid(hostile, false, signal);
          const root = window.document.createElement("div");
          root.innerHTML = safe;
          expect(root.querySelector("script, img, a, foreignObject, [onerror], [onclick]")).toBeNull();
          expect(mermaid.mermaidAPI.getConfig().securityLevel).toBe("strict");
          expect(mermaid.mermaidAPI.getConfig().htmlLabels).toBe(false);
          expect(mermaid.mermaidAPI.getConfig().theme).toBe("default");
          expect(mermaid.mermaidAPI.getConfig().suppressErrorRendering).toBe(true);
          await expect(renderMermaid("not a diagram", false, signal)).rejects.toThrow();
          await expect(renderMermaid("x".repeat(50_001), false, signal)).rejects.toThrow("limit");
          const cancelled = new AbortController();
          const pending = renderMermaid(sources[0], false, cancelled.signal);
          cancelled.abort();
          await expect(pending).rejects.toThrow();
          expect(await renderMermaid(sources[0], false, signal)).toContain("<svg");
          expect(document.body.childElementCount).toBe(0);
        } finally {
          window.close();
        }
      `,
    ],
    { cwd: import.meta.dirname },
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
}, 20_000);

const spawnProcessSync = (argv: string[], options: { cwd?: string } = {}) => {
  const result = spawnSync(argv[0]!, argv.slice(1), options);
  return { ...result, exitCode: result.status };
};
