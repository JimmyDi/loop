import { readFile } from "node:fs/promises";
import { vi, expect, test } from "vitest";
import { JSDOM } from "jsdom";

import * as renderer from "../../lib/mermaid";

test("Mermaid preview is borderless and its copy icon appears on hover, focus or touch", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    const style = window.document.createElement("style");
    style.textContent = await readFile(import.meta.dirname + "/MarkdownText.css", "utf8");
    window.document.head.append(style);
    window.document.body.innerHTML = `<div class="markdown-mermaid">
      <button class="markdown-code-copy markdown-mermaid-copy"></button>
      <div class="markdown-mermaid-preview"></div>
    </div>`;
    const figure = window.document.querySelector(".markdown-mermaid")!;
    const button = window.document.querySelector("button")!;
    expect(window.getComputedStyle(figure).borderTopWidth).toBe("0px");
    expect(window.getComputedStyle(button).position).toBe("absolute");
    expect(window.getComputedStyle(button).opacity).toBe("0");
    expect(window.getComputedStyle(button).pointerEvents).toBe("none");
    expect(window.getComputedStyle(button).right).toBe("10px");
    expect(window.getComputedStyle(button).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(window.getComputedStyle(button).borderTopWidth).toBe("0px");
    const rules = [...style.sheet!.cssRules];
    const reveal = rules.find((rule) =>
      rule.cssText.includes(".markdown-mermaid:hover > .markdown-mermaid-copy"),
    ) as CSSStyleRule;
    expect(reveal.selectorText).toContain(".markdown-mermaid:focus-within");
    expect(reveal.selectorText).toContain('.markdown-mermaid-copy[data-copy-status="copied"]');
    expect(reveal.style.opacity).toBe("1");
    expect(reveal.style.getPropertyValue("pointer-events")).toBe("auto");
    const hover = rules.find((rule) =>
      rule.cssText.startsWith(".markdown-mermaid-copy:hover"),
    ) as CSSStyleRule;
    expect(hover.style.getPropertyValue("background")).toBe("");
    expect(hover.style.getPropertyValue("background-color")).toBe("");
    expect(hover.style.color).toBe("var(--ink)");
    const touch = rules.find((rule) => rule.cssText.startsWith("@media")) as CSSMediaRule;
    expect(touch.conditionText).toBe("(hover: none)");
    const touchButton = touch.cssRules[0] as CSSStyleRule;
    expect(touchButton.selectorText).toBe(".markdown-mermaid-copy");
    expect(touchButton.style.opacity).toBe("1");
    expect(touchButton.style.getPropertyValue("pointer-events")).toBe("auto");
  } finally {
    window.close();
  }
});

test("MarkdownText renders safe markup and a copy control", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { MarkdownText } = await import("./MarkdownText");

    await import("../../i18n/setup");

    const html = renderToStaticMarkup(
      <MarkdownText text={"**Hello**\n\n```typescript\nconst x = 1;\n```"} />,
    );

    expect(html).toContain("<strong>Hello</strong>");
    expect(html).toContain("markdown-code-copy");
    const { MessageImageContext } = await import("../../lib/message-image-context");
    const image = renderToStaticMarkup(
      <MessageImageContext value="example">
        <MarkdownText text="![Screenshot](shots/result.png)" />
      </MessageImageContext>,
    );
    expect(image).toContain("/api/sessions/example/images?path=shots%2Fresult.png");
    const files = renderToStaticMarkup(
      <MessageImageContext value="example">
        <MarkdownText text={"[Movie](artifacts/movie.mp4)\n\n[Report](artifacts/report.pdf)"} />
      </MessageImageContext>,
    );
    expect(files).toContain("<video");
    expect(files).toContain("/api/sessions/example/files?path=artifacts%2Fmovie.mp4&amp;preview=1");
    expect(files).toContain("Preview PDF");
    expect(files).toContain('download="report.pdf"');
  } finally {
    Object.assign(globalThis, previous);
    window.close();
  }
});

test("MarkdownText renders Mermaid blocks without changing code or response copying", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  };
  Object.assign(globalThis, { window, document: window.document });
  const copied: string[] = [];
  let clipboardFails = false;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: window.navigator.userAgent,
      clipboard: {
        writeText: async (text: string) => {
          if (clipboardFails) throw new Error("Clipboard unavailable");
          copied.push(text);
        },
      },
    },
  });
  const renderDiagram = vi
    .spyOn(renderer, "renderMermaid")
    .mockResolvedValue("<svg><text>Rendered diagram, not source</text></svg>");
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const { MarkdownText } = await import("./MarkdownText");
  const { AssistantMessage } = await import("./AssistantMessage");
  const { i18n } = await import("../../i18n/setup");
  const language = i18n.language;
  const source = 'flowchart LR\n  A["<b>Start</b>"] --> B[End]\n';
  const text = "**Response**\n\n```mermaid\n" + source + "```\n\n```typescript\nconst x = 1;\n```";
  try {
    await i18n.changeLanguage("en");
    const ui = render(<MarkdownText text={text} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    await vi.waitFor(() =>
      expect(ui.container.querySelector(".hljs-keyword")?.textContent).toBe("const"),
    );
    await vi.waitFor(() =>
      expect(ui.container.querySelector(".markdown-mermaid-preview svg")).not.toBeNull(),
    );
    expect(ui.container.querySelector("strong")?.textContent).toBe("Response");
    const diagram = ui.container.querySelector(".markdown-mermaid")!;
    const raw = diagram.querySelector("pre")!;
    const preview = diagram.querySelector<HTMLElement>(".markdown-mermaid-preview")!;
    expect(diagram.querySelector("details, summary")).toBeNull();
    expect(raw.hidden).toBe(true);
    expect(preview.hidden).toBe(false);
    expect(ui.queryByRole("button", { name: "Raw" })).toBeNull();
    expect(ui.queryByRole("button", { name: "Preview" })).toBeNull();
    const copy = ui.getByRole("button", { name: "Copy Mermaid source" });
    expect(copy.title).toBe("Copy Mermaid source");
    expect(copy.textContent?.trim()).toBe("");
    expect(copy.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(raw.querySelector("code")?.textContent).toBe(source);
    expect(raw.querySelector("code")?.children.length).toBe(0);
    expect(copied).toEqual([]);
    // Clicking the nested icon copies once, without the delegated Markdown handler.
    await act(async () => fireEvent.click(copy.querySelector("path")!));
    expect(copied).toEqual([source]);
    expect(ui.getByText("Copied")).toBeDefined();
    expect(copy.dataset.copyStatus).toBe("copied");
    expect(copy.querySelector("rect")).toBeNull();
    expect(copy.querySelector("path")?.getAttribute("d")).toBe("m5 12 4 4L19 6");
    expect(copy.title).toBe("Copied");
    expect(raw.hidden).toBe(true);
    expect(preview.hidden).toBe(false);
    clipboardFails = true;
    await act(async () => fireEvent.click(copy));
    expect(ui.getByText("Could not copy")).toBeDefined();
    expect(copy.dataset.copyStatus).toBe("failed");
    expect(copy.querySelector("rect")).not.toBeNull();
    expect(copied).toEqual([source]);
    expect(preview.hidden).toBe(false);
    clipboardFails = false;
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Copy" })));
    expect(copied.at(-1)).toBe("const x = 1;\n");
    expect(renderDiagram).toHaveBeenCalledTimes(1);

    const second = "sequenceDiagram\n  Alice->>Bob: Hello\n";
    const updated = source.replace("End", "Done");
    ui.rerender(
      <MarkdownText text={"```mermaid\n" + updated + "```\n\n```mermaid\n" + second + "```"} />,
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const buttons = ui.getAllByRole("button", { name: "Copy Mermaid source" });
    await act(async () => fireEvent.click(buttons[1]!));
    expect(copied.at(-1)).toBe(second);
    expect(buttons[1]!.dataset.copyStatus).toBe("copied");
    expect(buttons[0]!.dataset.copyStatus).toBe("copy");
    await act(async () => fireEvent.click(buttons[0]!));
    expect(copied.at(-1)).toBe(updated);
    ui.unmount();

    const message = {
      role: "assistant" as const,
      content: [{ type: "text" as const, text }],
      api: "openai-completions" as const,
      provider: "test",
      model: "test",
      timestamp: 0,
      stopReason: "stop" as const,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    const response = render(<AssistantMessage message={message} tools={{}} streaming />);
    expect(response.container.querySelector(".markdown-mermaid")).toBeNull();
    response.rerender(<AssistantMessage message={message} tools={{}} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    await vi.waitFor(() =>
      expect(response.container.querySelector(".markdown-mermaid-preview svg")).not.toBeNull(),
    );
    await act(async () => fireEvent.click(response.getByRole("button", { name: "Copy response" })));
    expect(copied.at(-1)).toBe(text);

    const count = renderDiagram.mock.calls.length;
    response.unmount();
    const plain = render(<MarkdownText text={"`mermaid`\n\n```text\nflowchart LR\nA-->B\n```"} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(renderDiagram).toHaveBeenCalledTimes(count);
    expect(plain.container.querySelector(".markdown-mermaid")).toBeNull();
  } finally {
    cleanup();
    renderDiagram.mockRestore();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    if (previous.navigator) Object.defineProperty(globalThis, "navigator", previous.navigator);
    window.close();
  }
});

test("inline image file links stay in their sentence without duplicate download cards", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { MarkdownText } = await import("./MarkdownText");
    const { MessageImageContext } = await import("../../lib/message-image-context");
    const html = renderToStaticMarkup(
      <MessageImageContext value="example">
        <MarkdownText
          text={
            "Preview ready. You can [open the image](shots/result.png).\n\n![Preview](shots/result.png)"
          }
        />
      </MessageImageContext>,
    );
    const root = window.document.createElement("div");
    root.innerHTML = html;
    expect(root.querySelector(".markdown-text")?.textContent?.trim()).toBe(
      "Preview ready. You can open the image.",
    );
    const link = root.querySelector(".markdown-text a")!;
    expect(link.getAttribute("href")).toBe("/api/sessions/example/files?path=shots%2Fresult.png");
    expect(link.hasAttribute("download")).toBe(true);
    expect(root.querySelectorAll(".message-file")).toHaveLength(0);
    expect(root.querySelectorAll("img")).toHaveLength(1);
  } finally {
    Object.assign(globalThis, previous);
    window.close();
  }
});
