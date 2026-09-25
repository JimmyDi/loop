import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("MarkdownText renders safe markup and a copy control", async () => {
  const window = new Window();
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
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
