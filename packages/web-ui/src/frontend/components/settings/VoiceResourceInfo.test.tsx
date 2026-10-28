import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceResourceInfo } from "./VoiceResourceInfo";

test("information opens on hover or focus, retains details and closes on Escape", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <VoiceResourceInfo
        statusText={i18n.t("voice.checkFailed")}
        error={i18n.t("voice.downloadFailed")}
        component={{
          id: "engine",
          name: "Local engine",
          kind: "engine",
          version: "1",
          installed: true,
          downloadBytes: 1048576,
          requiredBytes: 3145728,
          installedBytes: 0,
          license: "MIT",
        }}
      />,
    );
    const button = view.getByRole("button", {
      name: "Local engine: " + i18n.t("voice.resourceDetails"),
    });
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(button.parentElement!);
    expect(view.getByRole("tooltip").textContent).toContain("MIT");
    expect(view.getByRole("tooltip").textContent).toContain(i18n.t("voice.checkFailed"));
    expect(view.getByRole("tooltip").textContent).toContain(i18n.t("voice.downloadFailed"));
    expect(view.getByRole("tooltip").textContent).not.toContain(i18n.t("voice.installed"));
    expect(view.getByRole("tooltip").textContent).toContain("Download: 1 MiB");
    expect(view.getByRole("tooltip").textContent).toContain("Installed size: 3 MiB");
    expect(view.getByRole("tooltip").textContent).toContain("Local engine");
    fireEvent.mouseLeave(button.parentElement!);
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(button);
    expect(button.getAttribute("aria-describedby")).toBe(view.getByRole("tooltip").id);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.click(button);
    expect(view.getByRole("tooltip")).toBeDefined();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
