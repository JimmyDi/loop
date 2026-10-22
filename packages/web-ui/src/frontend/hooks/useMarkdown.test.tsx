import { JSDOM } from "jsdom";
import { expect, test, vi } from "vitest";

import { useMarkdown } from "./useMarkdown";

const loaded = vi.hoisted(() => ({ math: vi.fn(), highlight: vi.fn() }));
vi.mock("../lib/markdown-math", async () => {
  loaded.math();
  const { Marked } = await import("marked");
  return {
    mathParser: new Marked({ renderer: { paragraph: () => '<p class="fixture-math">Math</p>' } }),
  };
});
vi.mock("../lib/markdown-highlight", () => {
  loaded.highlight();
  return { highlightCode: () => '<span class="fixture-highlight">Code</span>' };
});

test("ordinary messages render immediately and math/highlighting download only when needed", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const View = ({ text }: { text: string }) => (
    <div dangerouslySetInnerHTML={{ __html: useMarkdown(text, "Copy", "Table") }} />
  );
  const { render, cleanup } = await import("@testing-library/react/pure");
  try {
    const ui = render(<View text="**Example**" />);
    expect(ui.container.querySelector("strong")?.textContent).toBe("Example");
    expect(loaded.math).not.toHaveBeenCalled();
    expect(loaded.highlight).not.toHaveBeenCalled();
    ui.rerender(<View text={"```typescript\nconst x = 1;\n```"} />);
    await vi.waitFor(() => expect(ui.container.innerHTML).toContain("fixture-highlight"));
    expect(loaded.math).not.toHaveBeenCalled();
    ui.rerender(<View text="$x^2$" />);
    await vi.waitFor(() => expect(ui.container.querySelector(".fixture-math")).not.toBeNull());
    expect(loaded.math).toHaveBeenCalledOnce();
    expect(loaded.highlight).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    window.close();
  }
});
