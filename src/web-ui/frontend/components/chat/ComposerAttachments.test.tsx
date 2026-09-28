import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { ComposerAttachments } from "./ComposerAttachments";

test("image picker previews attachments, removes them and disables interaction while sending", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const images = [{ type: "image" as const, mimeType: "image/png", data: "AAAA" }];
  let removed = -1;
  let files: File[] = [];
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <ComposerAttachments
        images={images}
        disabled={false}
        add={(value) => {
          files = value;
        }}
        remove={(index) => {
          removed = index;
        }}
      />,
    );
    expect(view.getByRole("img", { name: "Image attachment 1" }).getAttribute("src")).toBe(
      "data:image/png;base64,AAAA",
    );
    fireEvent.click(view.getByRole("button", { name: "Remove image 1" }));
    expect(removed).toBe(0);
    const file = new File(["test"], "test.png", { type: "image/png" });
    fireEvent.change(view.container.querySelector("input")!, { target: { files: [file] } });
    expect(files).toEqual([file]);
    view.rerender(
      <ComposerAttachments images={images} disabled add={() => {}} remove={() => {}} />,
    );
    expect(
      (view.getByRole("button", { name: "Attach images" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", { name: "Remove image 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
