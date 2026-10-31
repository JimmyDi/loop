import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { integrationDemoFrames } from "./integration-demo";
import { IntegrationIllustration } from "./IntegrationIllustration";

afterEach(cleanup);

it("describes the fictional engineering setup and supports pausing without scene navigation", () => {
  const { container } = render(<IntegrationIllustration />);
  const description = screen.getByRole("img").getAttribute("aria-label");
  expect(description).toContain("虚构配置");
  expect(description).toContain("STDIO MCP");
  expect(description).toContain("Streamable HTTP MCP");
  expect(description).toContain("评审 Skill");
  expect(container.querySelector('[data-active="true"] img')?.getAttribute("src")).toContain(
    "stdio-zh-light.webp",
  );
  expect(screen.queryByRole("group")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "暂停 MCP 与 Skills 演示" }));
  expect(screen.getByRole("button", { name: "播放 MCP 与 Skills 演示" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "播放 MCP 与 Skills 演示" }));
  expect(screen.getByRole("button", { name: "暂停 MCP 与 Skills 演示" })).toBeTruthy();
});

it.each(["zh", "en"] as const)(
  "pairs every %s frame with distinct, bounded Light and Dark captures",
  (language) => {
    const { container } = render(
      <LanguageProvider initialLanguage={language}>
        <IntegrationIllustration />
      </LanguageProvider>,
    );
    const pictures = container.querySelectorAll("picture");
    expect(pictures).toHaveLength(integrationDemoFrames.length);
    for (const [index, { image }] of integrationDemoFrames.entries()) {
      const picture = pictures[index]!;
      expect(picture.querySelector("img")!.width).toBe(1020);
      expect(picture.querySelector("img")!.height).toBe(604);
      expect(picture.querySelector("source")?.media).toBe("(prefers-color-scheme: dark)");
      expect(picture.querySelector("source")?.srcset).toContain(
        `integration-demo/${image}-${language}-dark.webp`,
      );
      expect(picture.querySelector("img")?.src).toContain(
        `integration-demo/${image}-${language}-light.webp`,
      );
      const light = readFileSync(`public/integration-demo/${image}-${language}-light.webp`);
      const dark = readFileSync(`public/integration-demo/${image}-${language}-dark.webp`);
      expect(light.equals(dark)).toBe(false);
      for (const bytes of [light, dark]) {
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
        expect(bytes.subarray(12, 16).toString()).toBe("VP8L");
        const dimensions = bytes.readUInt32LE(21);
        expect((dimensions & 0x3fff) + 1).toBe(1020);
        expect(((dimensions >>> 14) & 0x3fff) + 1).toBe(604);
        expect(bytes.length).toBeLessThan(250_000);
      }
    }
  },
);
