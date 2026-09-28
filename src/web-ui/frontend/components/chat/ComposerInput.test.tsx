import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ComposerInput } from "./ComposerInput";
import { Window } from "happy-dom";

test("pasted images become attachments without inserting clipboard HTML", async () => {
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
        onImages={(value) => {
          files = value;
        }}
      />,
    );
    const image = new File(["test"], "test.png", { type: "image/png" });
    fireEvent.paste(view.getByRole("textbox"), {
      clipboardData: { files: [image], getData: () => "<img>" },
    });
    expect(files).toEqual([image]);
    expect(view.getByRole("textbox").textContent).toBe("Draft");
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
