import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { ComposerAttachments } from "./ComposerAttachments";

test("attachments preview images, allow removal and disable interaction while sending", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const images = [{ type: "image" as const, mimeType: "image/png", data: "AAAA" }];
  let removed = -1;
  let removedFile = -1;
  const files = [{ name: "example.ts", text: "<script>example</script>" }];
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <ComposerAttachments
        images={images}
        files={files}
        removeFile={(index) => {
          removedFile = index;
        }}
        disabled={false}
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
    expect(view.getByTitle("example.ts").textContent).toBe("example.ts");
    expect(view.container.querySelector("pre")?.textContent).toBe(files[0]!.text);
    expect(view.container.querySelector("script")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Remove file example.ts" }));
    expect(removedFile).toBe(0);
    view.rerender(
      <ComposerAttachments
        images={images}
        files={files}
        removeFile={() => {}}
        disabled
        remove={() => {}}
      />,
    );
    expect(
      (view.getByRole("button", { name: "Remove image 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", { name: "Remove file example.ts" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    view.rerender(
      <ComposerAttachments
        images={[]}
        files={[]}
        removeFile={() => {}}
        disabled={false}
        remove={() => {}}
      />,
    );
    expect(view.container.firstChild).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
