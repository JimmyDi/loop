import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogIllustration } from "./BlogIllustration";

afterEach(cleanup);

it("selects the article illustration in both languages and omits unassigned artwork", () => {
  const view = (slug: string, language: "zh" | "en") => (
    <LanguageProvider key={language} initialLanguage={language}>
      <BlogIllustration slug={slug} />
    </LanguageProvider>
  );
  const { rerender } = render(view("local-voice-167-mib", "en"));
  expect(screen.getByRole("img").getAttribute("alt")).toBe("Local voice input illustration");
  const image = screen.getByRole("img");
  expect(image.getAttribute("src")).toContain("illustration-960.webp");
  for (const width of [480, 960, 1536]) {
    expect(image.getAttribute("srcset")).toContain(`illustration-${width}.webp ${width}w`);
    const bytes = readFileSync(`public/blog/local-voice-167-mib/illustration-${width}.webp`);
    expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    expect(bytes.length).toBeLessThan(width === 1536 ? 350_000 : 150_000);
  }
  expect(image.getAttribute("sizes")).toContain("400px");
  rerender(view("local-voice-167-mib", "zh"));
  expect(screen.getByRole("img").getAttribute("alt")).toBe("本地语音输入插画");
  rerender(view("openui-generative-chat", "zh"));
  const cover = screen.getByRole("img", { name: "油画风格的聊天界面，展示柱状图和表单" });
  expect(cover.getAttribute("height")).toBe("864");
  for (const width of [480, 960, 1536]) {
    const path = `blog/openui-generative-chat/cover-${width}.webp`;
    expect(cover.getAttribute("srcset")).toContain(`${path} ${width}w`);
    expect(readFileSync(`public/${path}`).subarray(8, 12).toString()).toBe("WEBP");
  }
  rerender(view("openui-generative-chat", "en"));
  expect(
    screen.getByRole("img", {
      name: "Oil painting of a chat interface with a bar chart and a form",
    }),
  ).toBeTruthy();
  rerender(view("unassigned-article", "en"));
  expect(screen.queryByRole("img")).toBeNull();
});
