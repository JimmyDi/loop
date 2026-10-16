import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { workflowDemoFrames } from "./workflow-demo";
import { QueueIllustration } from "./QueueIllustration";

afterEach(cleanup);

it("describes the fictional engineering setup and supports pausing without scene navigation", () => {
  const { container } = render(<QueueIllustration />);
  const description = screen.getByRole("img").getAttribute("aria-label");
  expect(description).toContain("虚构支付回调");
  expect(description).toContain("停止后继续生成");
  expect(description).toContain("自动压缩");
  expect(description).toContain("编辑待执行测试");
  expect(container.querySelector('[data-active="true"] img')?.getAttribute("src")).toContain(
    "queue-zh-light.webp",
  );
  expect(screen.queryByRole("group")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "暂停长任务演示" }));
  expect(screen.getByRole("button", { name: "播放长任务演示" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "播放长任务演示" }));
  expect(screen.getByRole("button", { name: "暂停长任务演示" })).toBeTruthy();
});

it.each(["zh", "en"] as const)(
  "pairs every %s frame with distinct, bounded Light and Dark captures",
  (language) => {
    const { container } = render(
      <LanguageProvider initialLanguage={language}>
        <QueueIllustration />
      </LanguageProvider>,
    );
    const pictures = container.querySelectorAll("picture");
    expect(pictures).toHaveLength(workflowDemoFrames.length);
    for (const [index, { image }] of workflowDemoFrames.entries()) {
      const picture = pictures[index]!;
      expect(picture.querySelector("img")!.width).toBe(1056);
      expect(picture.querySelector("img")!.height).toBe(696);
      expect(picture.querySelector("source")?.media).toBe("(prefers-color-scheme: dark)");
      expect(picture.querySelector("source")?.srcset).toContain(
        `workflow-demo/${image}-${language}-dark.webp`,
      );
      expect(picture.querySelector("img")?.src).toContain(
        `workflow-demo/${image}-${language}-light.webp`,
      );
      const light = readFileSync(`public/workflow-demo/${image}-${language}-light.webp`);
      const dark = readFileSync(`public/workflow-demo/${image}-${language}-dark.webp`);
      expect(light.equals(dark)).toBe(false);
      for (const bytes of [light, dark]) {
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
        expect(bytes.subarray(12, 16).toString()).toBe("VP8L");
        const dimensions = bytes.readUInt32LE(21);
        expect((dimensions & 0x3fff) + 1).toBe(1056);
        expect(((dimensions >>> 14) & 0x3fff) + 1).toBe(696);
        expect(bytes.length).toBeLessThan(250_000);
      }
    }
  },
);
