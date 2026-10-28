import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerSubmitActions } from "./ComposerSubmitActions";
import "../../i18n/setup";

test("voice icons remain before send when the draft contains text", async () => {
  const window = new Window();
  const control = {
    voice: { status: "idle" },
    prompt: { text: "Recognized speech" },
    setupComplete: false,
    blocked: false,
    editing: false,
  } as unknown as VoiceComposerControl;
  try {
    window.document.body.innerHTML = renderToStaticMarkup(
      <ComposerSubmitActions control={control}>
        <button type="submit" aria-label="Send message" />
      </ComposerSubmitActions>,
    );
    const actions = window.document.querySelector(".composer-submit-actions")!;
    const buttons = [...actions.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Voice input",
      "Call",
      "Send message",
    ]);
    for (const button of buttons.slice(0, -1)) {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe("");
      expect(button.querySelector("svg")).toBeTruthy();
      expect(button.closest(".voice-setup-hint")?.hasAttribute("title")).toBe(true);
    }
  } finally {
    await window.happyDOM.close();
  }
});

test.each(["conversation", "dictation"] as const)(
  "%s replaces Send with an orb and keeps voice controls beside it",
  (mode) => {
    const control = {
      voice: { mode, status: "connecting" },
      dictation: { active: mode === "dictation", finishing: false, samples: [] },
    } as unknown as VoiceComposerControl;
    const html = renderToStaticMarkup(
      <ComposerSubmitActions control={control}>
        <button type="submit">Send</button>
      </ComposerSubmitActions>,
    );
    expect(html).toContain("composer-voice-orb");
    expect(html).not.toContain('type="submit"');
    expect(html).toContain(mode === "conversation" ? "voice-call-actions" : "voice-input-sampler");
    expect(
      html.indexOf(mode === "conversation" ? "voice-call-actions" : "voice-input-sampler"),
    ).toBeLessThan(html.indexOf("composer-voice-orb"));
  },
);
