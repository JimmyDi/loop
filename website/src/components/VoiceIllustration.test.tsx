import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { VoiceIllustration } from "./VoiceIllustration";

afterEach(cleanup);

it.each(["zh", "en"] as const)(
  "pairs %s screenshots with live native theme selection",
  (language) => {
    const { container } = render(
      <LanguageProvider initialLanguage={language}>
        <VoiceIllustration />
      </LanguageProvider>,
    );
    expect(container.querySelector("source")?.media).toBe("(prefers-color-scheme: dark)");
    expect(container.querySelector("source")?.srcset).toContain(
      "queued-input-" + language + "-dark.webp",
    );
    expect(container.querySelector("img")?.src).toContain(
      "queued-input-" + language + "-light.webp",
    );
    expect(container.querySelector("img")?.width).toBe(1000);
    expect(container.querySelector("img")?.height).toBe(660);
    const light = readFileSync("public/voice-demo/queued-input-" + language + "-light.webp");
    const dark = readFileSync("public/voice-demo/queued-input-" + language + "-dark.webp");
    expect(light.equals(dark)).toBe(false);
    for (const bytes of [light, dark]) {
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      const dimensions = bytes.readUInt32LE(21);
      expect((dimensions & 0x3fff) + 1).toBe(1000);
      expect(((dimensions >>> 14) & 0x3fff) + 1).toBe(660);
      expect(bytes.length).toBeLessThan(250_000);
    }
  },
);
