import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";

import { i18n } from "../../i18n/setup";
import { GeneralSettings } from "./GeneralSettings";

test("General exposes default permission before language, separately from appearance settings", () => {
  const client = new QueryClient();
  client.setQueryData(["general-settings"], { permissionPreset: "read-only" });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <GeneralSettings />
    </QueryClientProvider>,
  );

  expect(html).toContain("Language");
  expect(html).toContain('aria-haspopup="listbox"');
  expect(html).toContain("Permission");
  expect(html.indexOf("Permission")).toBeLessThan(html.indexOf("Language"));
  expect(html).not.toContain("Theme");
  expect(html).not.toContain('type="radio"');
  client.clear();
});

test("resource updates refresh visible translations without a language change or remount", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const language = i18n.language;
  const description = i18n.getResource("zh", "translation", "languageDescription");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["general-settings"], { permissionPreset: "read-only" });
  let languageChanges = 0;
  const onLanguageChanged = () => {
    languageChanges++;
  };

  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");

  try {
    await i18n.changeLanguage("zh");
    i18n.on("languageChanged", onLanguageChanged);
    const view = render(
      <QueryClientProvider client={client}>
        <GeneralSettings />
      </QueryClientProvider>,
    );
    const trigger = view.getByRole("button", { name: "语言 中文" });

    fireEvent.click(trigger);
    expect(view.getByRole("option", { name: "中文" }).getAttribute("aria-selected")).toBe("true");
    await act(() => {
      i18n.addResourceBundle(
        "zh",
        "translation",
        { languageDescription: "更新后的语言说明" },
        true,
        true,
      );
    });

    expect(view.getByText("更新后的语言说明")).toBeTruthy();
    expect(view.queryByText(description)).toBeNull();
    expect(view.getByRole("button", { name: "语言 中文" })).toBe(trigger);
    expect(view.getByRole("listbox", { name: "语言" })).toBeTruthy();
    expect(i18n.language).toBe("zh");
    expect(document.documentElement.lang).toBe("zh");
    expect(languageChanges).toBe(0);
  } finally {
    cleanup();
    client.clear();
    i18n.off("languageChanged", onLanguageChanged);
    i18n.addResourceBundle("zh", "translation", { languageDescription: description }, true, true);
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
