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
  rerender(view("local-voice-167-mib", "zh"));
  expect(screen.getByRole("img").getAttribute("alt")).toBe("本地语音输入插画");
  rerender(view("unassigned-article", "en"));
  expect(screen.queryByRole("img")).toBeNull();
});
