import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { MAX_IMAGES } from "../../../shared/prompt-images";
import { MAX_TEXT_FILES } from "../../../shared/prompt-files";
import { i18n } from "../../i18n/setup";
import { ComposerAddMenu } from "./ComposerAddMenu";

test("Add menu filters supported attachments and supports dismissal and disabled states", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  let files: File[] = [];
  const add = (value: File[]) => {
    files = value;
  };
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <ComposerAddMenu disabled={false} imageCount={0} fileCount={0} add={add} />,
    );
    const trigger = view.getByRole("button", { name: "Add attachments" });
    const input = view.container.querySelector("input")!;
    let pickerOpened = 0;
    input.addEventListener("click", () => pickerOpened++);
    const acceptedTypes = input.accept.split(",");
    for (const type of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      ".txt",
      ".md",
      ".py",
      ".ts",
      ".json",
      ".csv",
    ])
      expect(acceptedTypes).toContain(type);
    for (const type of [".pdf", ".ppt", ".pptx", ".docx", ".zip", "image/*", "*/*"])
      expect(acceptedTypes).not.toContain(type);
    expect(input.multiple).toBe(true);
    expect(view.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(view.getByRole("menu", { name: "Add" })).toBeTruthy();
    const item = view.getByRole("menuitem", { name: "Files" });
    expect(document.activeElement).toBe(item);
    fireEvent.click(item);
    expect(pickerOpened).toBe(1);
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    const file = new File(["test"], "test.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(files).toEqual([file]);
    expect(input.value).toBe("");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(view.getByRole("menuitem"), { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("menuitem"), { key: "Tab" });
    expect(view.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    view.rerender(<ComposerAddMenu disabled imageCount={0} fileCount={0} add={add} />);
    expect(view.queryByRole("menu")).toBeNull();
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect(input.disabled).toBe(true);
    view.rerender(
      <ComposerAddMenu disabled={false} imageCount={MAX_IMAGES} fileCount={0} add={add} />,
    );
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
    view.rerender(
      <ComposerAddMenu
        disabled={false}
        imageCount={MAX_IMAGES}
        fileCount={MAX_TEXT_FILES}
        add={add}
      />,
    );
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
