import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerSubmitActions } from "./ComposerSubmitActions";
import "../../i18n/setup";

test.each([true, false])(
  "voice icons stay immediately before send with visible dictation=%s",
  async (showVoiceInput) => {
    const window = new Window();
    const control = {
      voice: { status: "idle" },
      setupComplete: false,
      blocked: false,
      editing: false,
    } as unknown as VoiceComposerControl;
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <ComposerSubmitActions control={control} showVoiceInput={showVoiceInput}>
          <button type="submit" aria-label="Send message" />
        </ComposerSubmitActions>,
      );
      const actions = window.document.querySelector(".composer-submit-actions")!;
      const buttons = [...actions.querySelectorAll("button")];
      expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
        showVoiceInput ? ["Voice input", "Call", "Send message"] : ["Call", "Send message"],
      );
      for (const button of buttons.slice(0, -1)) {
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe("");
        expect(button.querySelector("svg")).toBeTruthy();
        expect(button.closest(".voice-setup-hint")?.hasAttribute("title")).toBe(true);
      }
    } finally {
      await window.happyDOM.close();
    }
  },
);
