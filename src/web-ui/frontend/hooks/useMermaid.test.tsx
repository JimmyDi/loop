import { expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

import * as renderer from "../lib/mermaid";
import { useTheme } from "../state/theme-store";
import { useMermaid } from "./useMermaid";
import { i18n } from "../i18n/setup";

test("Mermaid enhancement preserves sources, caches current diagrams and follows theme and language", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const theme = useTheme.getState().theme;
  const language = i18n.language;
  let systemDark = false;
  const listeners = new Set<() => void>();
  window.matchMedia = (() => ({
    get matches() {
      return systemDark;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  Object.assign(globalThis, { window, document: window.document });
  const renderDiagram = spyOn(renderer, "renderMermaid").mockImplementation(
    async (source, dark) => {
      if (source === "invalid") throw new Error("Invalid diagram");
      return `<svg data-theme="${dark ? "dark" : "light"}"><text>${source}</text></svg>`;
    },
  );
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const block = (source: string) =>
    `<pre><button class="markdown-code-copy">Copy</button><code class="language-mermaid">${source}</code></pre>`;
  const html =
    block("flowchart LR\nA--&gt;B") + block("invalid") + block("sequenceDiagram\nA-&gt;&gt;B: Hi");
  const Harness = ({ html, streaming = false }: { html: string; streaming?: boolean }) => (
    <div ref={useMermaid(html, streaming)} dangerouslySetInnerHTML={{ __html: html }} />
  );
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));

  try {
    useTheme.setState({ theme: "system" });
    await i18n.changeLanguage("en");
    const ui = render(<Harness html={html} />);
    await settle();
    expect(ui.container.querySelectorAll(".markdown-mermaid-preview svg")).toHaveLength(2);
    expect(ui.getAllByRole("button", { name: "Copy" })).toHaveLength(1);
    expect(ui.getAllByRole("button", { name: "Copy Mermaid source" })).toHaveLength(2);
    expect(ui.container.querySelector(".markdown-mermaid pre code")?.textContent).toBe(
      "flowchart LR\nA-->B",
    );
    expect(ui.container.querySelector("details, summary")).toBeNull();
    const diagrams = [...ui.container.querySelectorAll<HTMLElement>(".markdown-mermaid")];
    expect(diagrams.every((diagram) => diagram.querySelector("pre")!.hidden)).toBe(true);
    expect(ui.queryByRole("button", { name: "Raw" })).toBeNull();
    expect(ui.queryByRole("button", { name: "Preview" })).toBeNull();
    for (const button of ui.getAllByRole("button", { name: "Copy Mermaid source" })) {
      expect(button.title).toBe("Copy Mermaid source");
      expect(button.textContent?.trim()).toBe("");
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    expect(ui.container.querySelector(".markdown-mermaid-preview")?.getAttribute("tabindex")).toBe(
      "0",
    );
    expect(ui.getAllByRole("region", { name: "Mermaid diagram" })).toHaveLength(2);
    expect(ui.container.querySelector(".markdown-mermaid-error")?.textContent).toContain("source");
    expect(renderDiagram).toHaveBeenCalledTimes(3);

    ui.rerender(<Harness html={html + "<p>More text</p>"} />);
    await settle();
    expect(renderDiagram).toHaveBeenCalledTimes(4); // Only the invalid diagram is retried.
    expect(ui.container.querySelectorAll(".markdown-mermaid")).toHaveLength(2);
    expect(ui.getAllByRole("button", { name: "Copy Mermaid source" })).toHaveLength(2);
    expect(ui.container.querySelector(".markdown-mermaid pre")!.hasAttribute("hidden")).toBe(true);
    await act(() => i18n.changeLanguage("zh"));
    await settle();
    expect(ui.getAllByRole("region", { name: "Mermaid 图表" })).toHaveLength(2);
    expect(ui.getAllByRole("button", { name: "复制 Mermaid 源码" })).toHaveLength(2);
    expect(ui.container.querySelector("details, summary")).toBeNull();
    expect(ui.container.querySelector(".markdown-mermaid-error")?.textContent).toContain(
      "无法渲染",
    );

    act(() => {
      systemDark = true;
      for (const listener of listeners) listener();
    });
    await settle();
    expect(ui.container.querySelectorAll('svg[data-theme="dark"]')).toHaveLength(2);
    act(() => useTheme.getState().setTheme("light"));
    await settle();
    expect(ui.container.querySelectorAll('svg[data-theme="light"]')).toHaveLength(2);
    expect(ui.getAllByRole("button", { name: "复制 Mermaid 源码" })).toHaveLength(2);
    ui.rerender(<Harness html="<p>No diagram</p>" />);
    await settle();
    expect(ui.container.querySelector(".markdown-mermaid")).toBeNull();
    ui.rerender(<Harness html={html} />);
    await settle();
    expect(ui.getAllByRole("button", { name: "复制 Mermaid 源码" })).toHaveLength(2);
    ui.unmount();
    expect(listeners.size).toBe(0);
  } finally {
    cleanup();
    renderDiagram.mockRestore();
    useTheme.setState({ theme });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("streaming Mermaid debounces tokens, rejects stale results and cancels work on unmount", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const pending: { signal: AbortSignal; resolve: (svg: string) => void; reject: () => void }[] = [];
  const renderDiagram = spyOn(renderer, "renderMermaid").mockImplementation(
    (_source, _dark, signal) =>
      new Promise((resolve, reject) => {
        pending.push({ signal, resolve, reject: () => reject(new Error("Incomplete")) });
      }),
  );
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const Harness = ({ source, streaming = true }: { source: string; streaming?: boolean }) => {
    const html = `<pre><code class="language-mermaid">${source}</code></pre>`;
    return <div ref={useMermaid(html, streaming)} dangerouslySetInnerHTML={{ __html: html }} />;
  };
  const settle = (ms = 30) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  try {
    const ui = render(<Harness source="flowchart" />);
    ui.rerender(<Harness source="flowchart LR" />);
    ui.rerender(<Harness source={"flowchart LR\nA--&gt;"} />);
    expect(renderDiagram).not.toHaveBeenCalled();
    await settle(230);
    expect(renderDiagram).toHaveBeenCalledTimes(1);
    await act(async () => pending[0]!.reject());
    expect(ui.container.querySelector(".markdown-mermaid-error")).toBeNull();
    expect(ui.container.textContent).toContain("A-->");

    ui.rerender(<Harness source={"flowchart LR\nA--&gt;Old"} />);
    await settle(230);
    ui.rerender(<Harness source={"flowchart LR\nA--&gt;New"} streaming={false} />);
    expect(pending[1]!.signal.aborted).toBe(true);
    await settle();
    await act(async () => pending[1]!.resolve("<svg><text>Old</text></svg>"));
    expect(ui.container.querySelector("svg")).toBeNull();
    await act(async () => pending[2]!.resolve("<svg><text>New</text></svg>"));
    expect(ui.container.querySelector(".markdown-mermaid-preview svg")?.textContent).toBe("New");

    ui.rerender(<Harness source={"flowchart LR\nA--&gt;Newest"} />);
    await settle(230);
    await act(async () => pending[3]!.resolve("<svg><text>Newest</text></svg>"));
    expect(ui.container.querySelector(".markdown-mermaid-preview svg")?.textContent).toBe("Newest");
    expect(ui.container.querySelector("pre")!.hidden).toBe(true);
    expect(ui.container.querySelector("code")?.textContent).toBe("flowchart LR\nA-->Newest");
    ui.rerender(<Harness source={"flowchart LR\nA--&gt;Newest"} streaming={false} />);
    await settle();
    expect(ui.container.querySelectorAll(".markdown-mermaid-copy")).toHaveLength(1);
    expect(ui.container.querySelector("pre")!.hidden).toBe(true);
    expect(pending).toHaveLength(4);

    ui.rerender(<Harness source="invalid" streaming={false} />);
    await settle();
    await act(async () => pending[4]!.reject());
    expect(ui.container.querySelector("pre")!.hidden).toBe(false);
    expect(ui.container.querySelector(".markdown-mermaid-error")).not.toBeNull();
    ui.rerender(<Harness source="sequenceDiagram" streaming={false} />);
    await settle();
    ui.unmount();
    expect(pending[5]!.signal.aborted).toBe(true);
    await act(async () => pending[5]!.resolve("<svg/>"));
    expect(document.querySelector(".markdown-mermaid")).toBeNull();
  } finally {
    cleanup();
    renderDiagram.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
