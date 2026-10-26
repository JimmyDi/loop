import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { VoiceStatus } from "../../../shared/voice";
import { i18n } from "../../i18n/setup";
import { VoiceDownloadProgress } from "./VoiceDownloadProgress";

test.each([
  [undefined, undefined, "Downloading and verifying…"],
  [{ received: 1048576 }, undefined, "Downloading and verifying… 1 MiB"],
  [{ received: 1048576, total: 0 }, undefined, "Downloading and verifying… 1 MiB"],
  [{ received: 1048576, total: -1 }, undefined, "Downloading and verifying… 1 MiB"],
  [{ received: 0, total: 2097152 }, 0, "Downloading and verifying… 0 MiB / 2 MiB"],
  [{ received: 1048576, total: 2097152 }, 50, "Downloading and verifying… 1 MiB / 2 MiB"],
  [{ received: 3145728, total: 2097152 }, 100, "Downloading and verifying… 3 MiB / 2 MiB"],
  [{ received: -1, total: 2097152 }, 0, "Downloading and verifying… 0 MiB / 2 MiB"],
] satisfies [VoiceStatus["download"], number | undefined, string][])(
  "download %j reports actual progress without inventing a percentage",
  async (download, percent, message) => {
    const window = new Window();
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <VoiceDownloadProgress download={download} />,
      );
      const bar = window.document.querySelector('[role="progressbar"]')!;
      const status = window.document.querySelector('[role="status"]')!;
      expect(bar.getAttribute("aria-label")).toBe("Downloading and verifying…");
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
      expect(bar.getAttribute("aria-valuenow")).toBe(
        percent === undefined ? null : String(percent),
      );
      expect(bar.getAttribute("aria-valuetext")).toBe(message);
      expect(bar.getAttribute("title")).toBe(message);
      expect(bar.getAttribute("data-indeterminate")).toBe(String(percent === undefined));
      expect(status.textContent).toBe(message);
      expect(status.className).toBe("sr-only");
      expect(status.id).toBe(bar.getAttribute("aria-describedby"));
      expect(window.document.querySelector(".voice-download-progress-percent")?.textContent).toBe(
        percent === undefined ? "—" : Math.floor(percent) + "%",
      );
      expect(bar.querySelector(".voice-download-progress-fill")?.getAttribute("style")).toBe(
        "width:" + (percent === undefined ? "28%" : percent + "%"),
      );
      expect(window.document.querySelector("button")).toBeNull();
    } finally {
      await window.happyDOM.close();
    }
  },
);

test.each([
  ["installing", "Downloading and verifying…"],
  ["updating", "Updating…"],
  ["uninstalling", "Removing…"],
] as const)("%s without download counts remains indeterminate", async (activity, message) => {
  const window = new Window();
  try {
    window.document.body.innerHTML = renderToStaticMarkup(
      <VoiceDownloadProgress activity={activity} />,
    );
    const bar = window.document.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-label")).toBe(message);
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.getAttribute("data-indeterminate")).toBe("true");
    expect(bar.getAttribute("title")).toBe(message);
    expect(window.document.querySelector('[role="status"]')?.textContent).toBe(message);
    expect(window.document.querySelector(".voice-download-progress-percent")?.textContent).toBe(
      "—",
    );
  } finally {
    await window.happyDOM.close();
  }
});

test("progress updates bytes and localizes the active phase when the language changes", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const language = i18n.language;
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <VoiceDownloadProgress
        activity="updating"
        download={{ received: 1048576, total: 4194304 }}
      />,
    );
    const bar = view.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    view.rerender(
      <VoiceDownloadProgress
        activity="updating"
        download={{ received: 3145728, total: 4194304 }}
      />,
    );
    expect(view.getByRole("progressbar")).toBe(bar);
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
    expect(bar.getAttribute("title")).toContain("3 MiB / 4 MiB");
    await act(async () => i18n.changeLanguage("zh"));
    expect(bar.getAttribute("aria-label")).toBe("正在更新…");
    expect(view.getByRole("status").textContent).toBe("正在更新… 3 MiB / 4 MiB");
    view.rerender(<VoiceDownloadProgress activity="uninstalling" />);
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(view.getByRole("status").textContent).toBe("正在卸载…");
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
