import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { PlanDocumentActions } from "./PlanDocumentActions";
import { i18n } from "../../i18n/setup";

test("copy and download use the complete Markdown", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: window.navigator.userAgent, clipboard: { writeText } },
    configurable: true,
  });
  Object.assign(globalThis, { window, document: window.document });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:plan");
  const click = vi.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { render, fireEvent, cleanup, waitFor, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <PlanDocumentActions plan={{ title: "Plan", markdown: "## Full Markdown" }} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("## Full Markdown"));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Copied"));
    expect(view.getByRole("button", { name: "Copied" }).getAttribute("data-status")).toBe("copied");
    fireEvent.click(view.getByRole("button", { name: "Download plan" }));
    expect(await (create.mock.calls[0]![0] as Blob).text()).toBe("## Full Markdown");
    expect(click).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await i18n.changeLanguage(language);
    create.mockRestore();
    click.mockRestore();
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    Object.defineProperty(globalThis, "navigator", {
      value: previous.navigator,
      configurable: true,
    });
    await window.happyDOM.close();
  }
});
