import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { HistoryMediaContext } from "../../lib/history-media-context";
import { MessageThumbnail } from "./MessageThumbnail";

test("paging suspends thumbnail sources without waiting for image load and resumes after completion", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const view = (paused: boolean) => (
    <HistoryMediaContext value={paused}>
      <MessageThumbnail src="/synthetic.png" alt="Synthetic preview" />
    </HistoryMediaContext>
  );
  try {
    const ui = render(view(false));
    const image = ui.getByAltText("Synthetic preview");
    expect(image.getAttribute("src")).toBe("/synthetic.png");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(image.getAttribute("fetchpriority")).toBe("low");
    expect(image.getAttribute("loading")).toBe("lazy");
    ui.rerender(view(true));
    expect(image.hasAttribute("src")).toBe(false);
    // Neither load nor error is dispatched: paging controls when requests resume.
    ui.rerender(view(false));
    expect(ui.getByAltText("Synthetic preview")).toBe(image);
    expect(image.getAttribute("src")).toBe("/synthetic.png");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
