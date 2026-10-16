import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { CopyCommand } from "./CopyCommand";
import { LanguageSwitch } from "./LanguageSwitch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([true, false])(
  "copies the startup command and translates feedback without resetting it: %s",
  async (success) => {
    const writeText = success
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new Error("Unavailable"));
    vi.stubGlobal("navigator", {
      languages: ["en-US"],
      language: "en-US",
      clipboard: { writeText },
    });
    render(
      <LanguageProvider>
        <LanguageSwitch />
        <CopyCommand />
      </LanguageProvider>,
    );
    const button = screen.getByRole("button", { name: "Copy startup command" });
    expect(button.textContent).toBe("Copy");
    expect(button.parentElement?.querySelector("code")?.textContent).toBe(
      "npx @loop-harness/loop web",
    );
    expect(button.parentElement?.querySelector('[aria-hidden="true"]')?.textContent).toBe("$");
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(success ? "Copied." : "selected"),
    );
    expect(writeText).toHaveBeenCalledWith("npx @loop-harness/loop web");
    expect(button.textContent).toBe(success ? "Copied" : "Copy");
    if (!success) expect(window.getSelection()?.toString()).toBe("npx @loop-harness/loop web");
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("status").textContent).toContain(success ? "已复制" : "已选中");
    expect(button.textContent).toBe(success ? "已复制" : "复制");
  },
);
