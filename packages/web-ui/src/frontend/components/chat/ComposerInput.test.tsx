import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ComposerInput } from "./ComposerInput";
import { Window } from "happy-dom";

test("mixed pasted files all become attachments without inserting clipboard HTML", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let files: File[] = [];
  try {
    const view = render(
      <ComposerInput
        value="Draft"
        onChange={() => {}}
        onSubmit={() => {}}
        disabled={false}
        placeholder="Message"
        onFiles={(value) => {
          files = value;
        }}
      />,
    );
    const image = new File(["test"], "test.png", { type: "image/png" });
    const source = new File(["example = 1"], "example.py", { type: "text/plain" });
    const markdown = new File(["# Example"], "notes.md", { type: "text/markdown" });
    fireEvent.paste(view.getByRole("textbox"), {
      clipboardData: { files: [image, source, markdown], getData: () => "<img>" },
    });
    expect(files).toEqual([image, source, markdown]);
    expect(view.getByRole("textbox").textContent).toBe("Draft");
    fireEvent.paste(view.getByRole("textbox"), {
      clipboardData: { files: [source], getData: () => "" },
    });
    expect(files).toEqual([source]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("ComposerInput exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ComposerInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled
        placeholder="Message"
      />
    </QueryClientProvider>,
  );

  expect(html).toContain('role="textbox"');
  expect(html).toContain('contentEditable="false"');
  expect(html).toContain('aria-multiline="true"');
  client.clear();
});
