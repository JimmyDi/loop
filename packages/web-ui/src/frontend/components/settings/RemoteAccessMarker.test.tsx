import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { RemoteAccessMarker } from "./RemoteAccessMarker";

test.each([
  [false, false, false, "Not completed", "incomplete", false],
  [true, false, false, "Completed", "completed", true],
  [true, false, true, "Check failed", "failed", true],
  [false, false, true, "Check failed", "failed", true],
  [true, true, true, "Loading", "loading", false],
] as const)(
  "marker complete=%s loading=%s failed=%s",
  async (complete, loading, failed, label, state, icon) => {
    const window = new Window();
    const container = window.document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <RemoteAccessMarker complete={complete} loading={loading} failed={failed} />,
    );
    const marker = container.querySelector('[role="img"]')!;
    expect(marker.getAttribute("aria-label")).toBe(label);
    expect(marker.getAttribute("data-state")).toBe(state);
    expect(!!marker.querySelector("svg")).toBe(icon);
    if (state === "failed")
      expect(marker.querySelector("path")?.getAttribute("d")).toBe("m6 6 8 8m0-8-8 8");
    await window.happyDOM.close();
  },
);
