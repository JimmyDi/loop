import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { VoiceStatus } from "../../../shared/voice";
import { i18n } from "../../i18n/setup";
import { VoiceResourcePackages } from "./VoiceResourcePackages";

const status: VoiceStatus = {
  supported: true,
  installed: false,
  localManagement: true,
  phase: "installing",
  packages: { asr: { phase: "installing", received: 0, total: 1 } },
  components: (["engine", "asr", "vad", "tts"] as const).map((kind) => ({
    id: kind,
    name: kind,
    kind,
    installed: kind === "engine",
    downloadBytes: 1,
    installedBytes: kind === "engine" ? 1 : 0,
    license: "MIT",
    version: "1",
  })),
};

test("shows completed, active and waiting packages in installation order", () => {
  const html = renderToStaticMarkup(<VoiceResourcePackages status={status} />);
  expect(html.match(/role="(?:img|progressbar)"/g)).toHaveLength(4);
  expect(html.match(/class="voice-resource-package-name"/g)).toHaveLength(4);
  for (const component of status.components!) {
    expect(html).toContain('title="' + component.name + '"');
    expect(html).toContain(">" + component.name + "</span>");
  }
  expect(html.match(/data-state="completed"/g)).toHaveLength(1);
  expect(html.match(/data-state="loading"/g)).toHaveLength(1);
  expect(html.match(/data-state="incomplete"/g)).toHaveLength(2);
  expect(html).toContain('aria-label="asr: ' + i18n.t("voice.loading") + '"');
});

test("only the failed package turns red and remaining packages keep waiting", () => {
  const html = renderToStaticMarkup(
    <VoiceResourcePackages
      status={{
        ...status,
        phase: "error",
        packages: { asr: { phase: "error", received: 0, total: 1 } },
      }}
    />,
  );
  expect(html.match(/data-state="failed"/g)).toHaveLength(1);
  expect(html.match(/data-state="incomplete"/g)).toHaveLength(2);
  expect(html).toContain('aria-label="asr: ' + i18n.t("voice.checkFailed") + '"');
});

test("cancellation clears the active marker without marking a package failed", () => {
  const html = renderToStaticMarkup(
    <VoiceResourcePackages
      status={{
        ...status,
        phase: "idle",
        packages: { asr: { phase: "cancelled", received: 0, total: 1 } },
      }}
    />,
  );
  expect(html).not.toContain('data-state="loading"');
  expect(html).not.toContain('data-state="failed"');
});

test("parallel package markers independently show loading and failure", () => {
  const html = renderToStaticMarkup(
    <VoiceResourcePackages
      status={{
        ...status,
        packages: {
          asr: { phase: "error", received: 0, total: 1 },
          vad: { phase: "installing", received: 0, total: 1 },
          tts: { phase: "installing", received: 0, total: 1 },
        },
      }}
    />,
  );
  expect(html.match(/data-state="failed"/g)).toHaveLength(1);
  expect(html.match(/data-state="loading"/g)).toHaveLength(2);
  expect(html.match(/data-state="completed"/g)).toHaveLength(1);
});
