import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { providerDemoFrames } from "./provider-demo";
import { ProviderIllustration } from "./ProviderIllustration";

afterEach(cleanup);

it("shows localized real-product frames without scene navigation and supports pausing", () => {
  const { container } = render(
    <LanguageProvider initialLanguage="en">
      <ProviderIllustration />
    </LanguageProvider>,
  );
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("fictional");
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("DeepSeek V4 Pro");
  expect(container.querySelector("source")?.getAttribute("srcset")).toContain("model-en-dark.webp");
  expect(screen.queryByRole("group", { name: "Provider demo scenes" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add provider" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Custom provider" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Model & effort" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Pause provider demo" }));
  expect(screen.getByRole("button", { name: "Play provider demo" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play provider demo" }));
  expect(screen.getByRole("button", { name: "Pause provider demo" })).toBeTruthy();
});

it("ships bounded independent frames for each language and theme", () => {
  for (const { image } of providerDemoFrames) {
    for (const language of ["zh", "en"]) {
      const light = readFileSync(`public/provider-demo/${image}-${language}-light.webp`);
      const dark = readFileSync(`public/provider-demo/${image}-${language}-dark.webp`);
      expect(light.equals(dark)).toBe(false);
      for (const theme of ["light", "dark"]) {
        const bytes = readFileSync(`public/provider-demo/${image}-${language}-${theme}.webp`);
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
        expect(bytes.subarray(12, 16).toString()).toBe("VP8L");
        const dimensions = bytes.readUInt32LE(21);
        expect((dimensions & 0x3fff) + 1).toBe(760);
        expect(((dimensions >>> 14) & 0x3fff) + 1).toBe(556);
        expect(bytes.length).toBeLessThan(250_000);
      }
    }
  }
});

it.each(["zh", "en"] as const)(
  "pairs every %s animation frame with native live-theme selection",
  (language) => {
    const { container } = render(
      <LanguageProvider initialLanguage={language}>
        <ProviderIllustration />
      </LanguageProvider>,
    );
    const pictures = container.querySelectorAll("picture");
    expect(pictures).toHaveLength(providerDemoFrames.length);
    for (const [index, { image }] of providerDemoFrames.entries()) {
      const picture = pictures[index]!;
      expect(picture.querySelector("img")!.width).toBe(760);
      expect(picture.querySelector("img")!.height).toBe(556);
      const source = picture.querySelector("source")!;
      expect(source.media).toBe("(prefers-color-scheme: dark)");
      expect(source.srcset).toContain(`provider-demo/${image}-${language}-dark.webp`);
      expect(picture.querySelector("img")!.getAttribute("src")).toContain(
        `provider-demo/${image}-${language}-light.webp`,
      );
    }
  },
);
