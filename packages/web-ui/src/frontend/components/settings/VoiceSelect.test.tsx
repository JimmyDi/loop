import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceSelect } from "./VoiceSelect";

test("options contain names and descriptions, with keyboard selection and Escape", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const onChange = vi.fn();
  try {
    const view = render(
      <VoiceSelect
        label={i18n.t("voice.chooseProfile")}
        value="conversation"
        onChange={onChange}
        options={[
          {
            value: "input",
            name: i18n.t("voice.inputProfile"),
            description: i18n.t("voice.inputProfileHint"),
          },
          {
            value: "conversation",
            name: i18n.t("voice.conversationProfile"),
            description: i18n.t("voice.conversationProfileHint"),
          },
        ]}
      />,
    );
    const trigger = view.getByRole("button", { name: i18n.t("voice.chooseProfile") });
    expect(view.queryByText(i18n.t("voice.inputProfileHint"))).toBeNull();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const input = view.getByRole("menuitemradio", { name: i18n.t("voice.inputProfile") });
    expect(input.textContent).toContain(i18n.t("voice.inputProfileHint"));
    expect(
      view.getByRole("menuitemradio", { name: i18n.t("voice.conversationProfile") }).textContent,
    ).toContain(i18n.t("voice.conversationProfileHint"));
    fireEvent.keyDown(view.getByRole("menu"), { key: "Home" });
    expect(window.document.activeElement).toBe(input);
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith("input");
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("menu"), { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(window.document.activeElement).toBe(trigger);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
