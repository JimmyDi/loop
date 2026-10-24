import { Window } from "happy-dom";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { MessageFiles } from "./MessageFiles";

test("files offer downloads, native media controls and a separate PDF preview", async () => {
  const window = new Window({ url: "https://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const prefix = "/api/sessions/example/files?path=";
    const view = render(
      <MessageFiles
        files={[
          { href: prefix + "movie.mp4", label: "Movie" },
          { href: prefix + "audio.mp3", label: "Audio" },
          { href: prefix + "report.pdf", label: "Report" },
          { href: prefix + "bundle.zip", label: "Archive" },
        ]}
      />,
    );
    const video = view.container.querySelector("video")!;
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("src")).toBe(prefix + "movie.mp4&preview=1");
    expect(view.container.querySelector("audio")!.hasAttribute("controls")).toBe(true);
    const pdf = view.getByRole("link", { name: "Preview PDF" });
    expect(pdf.getAttribute("target")).toBe("_blank");
    expect(pdf.getAttribute("href")).toBe(prefix + "report.pdf&preview=1");
    expect(view.getAllByRole("link", { name: "Download" })).toHaveLength(4);
    expect(view.container.querySelectorAll("a[download]")).toHaveLength(4);
    fireEvent.error(video);
    expect(view.getByRole("alert").textContent).toContain("Download the file");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
