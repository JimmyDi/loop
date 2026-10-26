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
      const select = window.document.querySelector("select")!;
      expect(select.value).toBe(profile);
      expect(select.disabled).toBe(true);
      expect(Array.from(select.options, (option) => option.value)).toEqual([
        "input",
        "conversation",
      ]);
      expect(window.document.querySelector(".voice-setup-step-number")?.textContent).toBe(
        i18n.t("voice.step", { number: 1 }),
      );
      expect(window.document.querySelector(".voice-profile-hint")?.textContent).toBe(
        i18n.t("voice." + (profile === "input" ? "inputProfileHint" : "conversationProfileHint")),
      );
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
    const select = view.getByRole("combobox", { name: i18n.t("voice.chooseProfile") });
    fireEvent.change(select, { target: { value: "input" } });
    expect(onChange).toHaveBeenCalledWith("input");
    expect(view.getByRole("listitem").getAttribute("data-complete")).toBe("true");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
