import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceSetupStep } from "./VoiceSetupStep";

test("setup step keeps its numbered heading, actions, progress, issue and detail together", async () => {
  const window = new Window();
  try {
    window.document.body.innerHTML = renderToStaticMarkup(
      <ol>
        <VoiceSetupStep
          number={2}
          title="Synthetic resources"
          complete={false}
          actions={<button type="button">Synthetic install</button>}
          progress={<div role="progressbar" aria-label="Synthetic download" />}
          issue="Synthetic failure"
        >
          <span>Synthetic resource detail</span>
        </VoiceSetupStep>
      </ol>,
    );
    const step = window.document.querySelector("li")!;
    const heading = step.querySelector("h4")!;
    expect(step.querySelector(".voice-setup-step-number")?.textContent).toBe(
      i18n.t("voice.step", { number: 2 }),
    );
    expect(heading.textContent).toBe("Synthetic resources");
    expect(heading.title).toBe("Synthetic resources");
    expect(heading.previousElementSibling?.tagName).toBe("BUTTON");
    expect(heading.nextElementSibling?.getAttribute("role")).toBe("progressbar");
    expect(step.querySelector('[role="alert"]')?.parentElement).toBe(heading.parentElement);
    expect(step.querySelector(".voice-setup-step-detail")?.textContent).toBe(
      "Synthetic resource detail",
    );
  } finally {
    await window.happyDOM.close();
  }
});

test.each([
  [false, false, false, "incomplete", false],
  [true, false, false, "completed", true],
  [true, false, true, "failed", false],
  [true, true, true, "loading", false],
] as const)(
  "completion is masked by loading or failure: complete=%s loading=%s failed=%s",
  async (complete, loading, failed, state, markedComplete) => {
    const window = new Window();
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <ol>
          <VoiceSetupStep
            number={1}
            title="Synthetic setup"
            complete={complete}
            loading={loading}
            failed={failed}
          />
        </ol>,
      );
      expect(window.document.querySelector("li")?.getAttribute("data-complete")).toBe(
        String(markedComplete),
      );
      expect(window.document.querySelector('[role="img"]')?.getAttribute("data-state")).toBe(state);
    } finally {
      await window.happyDOM.close();
    }
  },
);
