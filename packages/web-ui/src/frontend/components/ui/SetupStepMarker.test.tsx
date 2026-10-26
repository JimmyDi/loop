import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { SetupStepMarker } from "./SetupStepMarker";

test.each([
  [false, false, false, "incomplete", undefined],
  [true, false, false, "completed", "m5 10 3.2 3.2L15 6.5"],
  [true, false, true, "failed", "m6 6 8 8m0-8-8 8"],
  [false, false, true, "failed", "m6 6 8 8m0-8-8 8"],
  [true, true, true, "loading", undefined],
] as const)(
  "setup marker complete=%s loading=%s failed=%s",
  async (complete, loading, failed, state, path) => {
    const window = new Window();
    try {
      const container = window.document.createElement("div");
      container.innerHTML = renderToStaticMarkup(
        <SetupStepMarker
          complete={complete}
          loading={loading}
          failed={failed}
          label="Synthetic setup status"
          className="feature-marker"
        />,
      );
      const marker = container.querySelector('[role="img"]')!;
      expect(marker.getAttribute("aria-label")).toBe("Synthetic setup status");
      expect(marker.getAttribute("data-state")).toBe(state);
      expect(marker.getAttribute("data-loading")).toBe(String(loading));
      expect(marker.classList.contains("setup-step-marker")).toBe(true);
      expect(marker.classList.contains("feature-marker")).toBe(true);
      expect(marker.querySelector("path")?.getAttribute("d")).toBe(path);
      if (path) expect(marker.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    } finally {
      await window.happyDOM.close();
    }
  },
);
