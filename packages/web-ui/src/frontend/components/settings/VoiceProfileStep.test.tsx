import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceProfileStep } from "./VoiceProfileStep";

test.each(["input", "conversation"] as const)(
  "step one shows the selected %s profile and keeps the dependency gate",
  async (profile) => {
    const window = new Window();
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <ol>
          <VoiceProfileStep
            profile={profile}
            disabled
            complete={false}
            loading={false}
            onChange={() => {}}
          />
        </ol>,
      );
      const button = window.document.querySelector("button")!;
      expect(button.textContent).toContain(
        i18n.t("voice." + (profile === "input" ? "inputProfile" : "conversationProfile")),
      );
      expect(button.disabled).toBe(true);
      expect(window.document.querySelector(".voice-profile-hint")).toBeNull();
      expect(window.document.querySelector("li")?.getAttribute("data-complete")).toBe("false");
    } finally {
      await window.happyDOM.close();
    }
  },
);

test("enabled profile choice reports the selected profile", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const onChange = vi.fn();
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <ol>
        <VoiceProfileStep
          profile="conversation"
          disabled={false}
          complete
          loading={false}
          onChange={onChange}
        />
      </ol>,
    );
    const select = view.getByRole("button", { name: i18n.t("voice.chooseProfile") });
    fireEvent.click(select);
    fireEvent.click(view.getByRole("menuitemradio", { name: i18n.t("voice.inputProfile") }));
    expect(onChange).toHaveBeenCalledWith("input");
    expect(view.getByRole("listitem").getAttribute("data-complete")).toBe("true");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
