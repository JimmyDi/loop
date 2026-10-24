import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { MessageImageGallery } from "./MessageImageGallery";

test("thumbnails open a navigable preview with actual-size inspection and focus restoration", async () => {
  const window = new Window({
    url: "https://example.test",
    settings: { handleDisabledFileLoadingAsSuccess: true },
  });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <MessageImageGallery
        images={[
          { src: "/first.png", alt: "First screenshot" },
          { src: "/second.png", alt: "Second screenshot" },
        ]}
      />,
    );
    const first = view.getByRole("button", { name: "Preview image 1" });
    first.focus();
    fireEvent.click(first);
    expect(view.getByRole("dialog", { name: "Image preview" })).toBeDefined();
    expect(view.getByRole("status").textContent).toBe("1 / 2");
    fireEvent.click(view.getByRole("button", { name: "View actual size" }));
    expect(
      view.getByRole("button", { name: "Fit image to window" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.keyDown(view.getByRole("button", { name: "Fit image to window" }), {
      key: "ArrowRight",
    });
    expect(view.getByRole("status").textContent).toBe("2 / 2");
    expect(view.getByRole("button", { name: "View actual size" })).toBeDefined();
    fireEvent.click(view.getByRole("button", { name: "Previous image" }));
    expect(view.getByRole("status").textContent).toBe("1 / 2");
    fireEvent.error(view.getByRole("dialog").querySelector("img")!);
    expect(view.getByRole("alert").textContent).toBe("Image could not be loaded.");
    fireEvent(
      view.getByRole("dialog"),
      new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event,
    );
    await vi.waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    expect(window.document.activeElement).toBe(first);
    fireEvent.click(view.getByRole("button", { name: "Preview image 2" }));
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(view.queryByRole("dialog")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
