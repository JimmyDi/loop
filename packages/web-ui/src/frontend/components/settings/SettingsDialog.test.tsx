import { expect, test } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { useTheme } from "../../state/theme-store";
import { AppShell } from "../layout/AppShell";

test("Settings opens General outside the mobile drawer and restores focus without closing the drawer", async () => {
  const window = new Window({ width: 390 });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  class LocalSource {
    close() {}
  }
  const language = i18n.language;
  const state = useWorkspace.getState();
  const theme = useTheme.getState().theme;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  client.setQueryData(["projects"], []);
  client.setQueryData(["provider-settings"], { providers: [], catalog: [] });
  client.setQueryData(["archived-chats"], []);
  client.setQueryData(["general-settings"], { permissionPreset: "read-only" });
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");

  try {
    await i18n.changeLanguage("en");
    useWorkspace.setState({
      sidebar: true,
      active: undefined,
      drafts: { example: "Unsent draft" },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <AppShell />
      </QueryClientProvider>,
    );
    const trigger = view.getByRole("button", { name: "Settings" });

    expect(view.queryByRole("button", { name: "Model settings" })).toBeNull();
    expect(view.queryByRole("combobox", { name: "Language" })).toBeNull();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = view.getByRole("dialog", { name: "Settings" });

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.parentElement).toBe(document.body);
    expect(view.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "Models",
      "Appearance",
      "Plugins",
      "Archived chats",
    ]);
    expect(view.getByRole("tablist", { name: "Archived" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Manage" })).toBeNull();
    fireEvent.click(view.getByRole("tab", { name: "Archived chats" }));
    expect(view.getByRole("tabpanel", { name: "Archived chats" })).toBeTruthy();
    expect(view.getAllByRole("dialog")).toHaveLength(1);
    expect(view.getByText("No archived chats")).toBeTruthy();
    fireEvent.click(view.getByRole("tab", { name: "General" }));
    expect(view.getByRole("tabpanel", { name: "General" })).toBeTruthy();
    expect(view.queryByRole("group", { name: "Theme" })).toBeNull();
    const general = view.getByRole("tab", { name: "General" });
    const appearance = view.getByRole("tab", { name: "Appearance" });
    const models = view.getByRole("tab", { name: "Models" });

    fireEvent.click(appearance);
    expect(view.getByRole("tabpanel", { name: "Appearance" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Language English" })).toBeNull();
    expect(general.tabIndex).toBe(-1);
    expect(appearance.tabIndex).toBe(0);
    fireEvent.click(view.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.keyDown(appearance, { key: "ArrowUp" });
    expect(document.activeElement).toBe(models);
    fireEvent.keyDown(models, { key: "ArrowUp" });
    expect(document.activeElement).toBe(general);
    expect(view.getByRole("tabpanel", { name: "General" })).toBeTruthy();
    fireEvent.keyDown(general, { key: "End" });
    expect(document.activeElement).toBe(appearance);
    expect((view.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(appearance, { key: "ArrowDown" });
    expect(document.activeElement).toBe(general);
    fireEvent.keyDown(general, { key: "ArrowDown" });
    expect(document.activeElement).toBe(models);
    fireEvent.keyDown(models, { key: "ArrowDown" });
    expect(document.activeElement).toBe(appearance);
    fireEvent.keyDown(appearance, { key: "Home" });
    expect(document.activeElement).toBe(general);
    fireEvent.click(view.getByRole("button", { name: "Language English" }));
    await act(async () => fireEvent.click(view.getByRole("option", { name: "中文" })));
    expect(view.getByRole("dialog", { name: "设置" })).toBe(dialog);
    expect(view.getByRole("heading", { name: "设置", level: 2 })).toBeTruthy();
    expect(view.getByRole("heading", { name: "通用", level: 3 })).toBeTruthy();
    expect(view.getByRole("heading", { name: "通用", level: 4 })).toBeTruthy();
    expect(view.getByRole("tab", { name: "通用" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getByRole("navigation", { name: "设置分类" })).toBeTruthy();
    expect(view.getByRole("tablist", { name: "归档" })).toBeTruthy();
    expect(view.getByRole("tab", { name: "已归档会话" })).toBeTruthy();
    expect(view.getByText("应用界面使用的语言")).toBeTruthy();
    expect(view.queryByText("languageDescription")).toBeNull();
    expect(view.getByRole("button", { name: "语言 中文" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(document.documentElement.lang).toBe("zh");
    fireEvent.click(view.getByRole("tab", { name: "外观" }));
    expect(view.getByRole("heading", { name: "外观" })).toBeTruthy();
    expect(view.getByRole("group", { name: "主题" })).toBeTruthy();
    expect(view.getByRole("radio", { name: "跟随系统" })).toBeTruthy();
    expect(view.getByRole("radio", { name: "浅色" })).toBeTruthy();
    expect((view.getByRole("radio", { name: "深色" }) as HTMLInputElement).checked).toBe(true);
    expect(useWorkspace.getState().drafts).toEqual({ example: "Unsent draft" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new window.Event("cancel", { cancelable: true }) as unknown as Event);
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.getByRole("button", { name: "设置" })).toBe(trigger);
    expect(useWorkspace.getState().sidebar).toBe(true);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(view.getByRole("tabpanel", { name: "通用" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "关闭" }));
    expect(view.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(view.getByRole("button", { name: "语言 中文" }));
    await act(async () => fireEvent.click(view.getByRole("option", { name: "English" })));
    expect(view.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(view.getByRole("heading", { name: "General", level: 3 })).toBeTruthy();
    expect(view.getByRole("heading", { name: "General", level: 4 })).toBeTruthy();
    expect(view.getByText("Language for the app UI")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    fireEvent.click(view.getByRole("tab", { name: "Appearance" }));
    expect(view.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(view.getByRole("group", { name: "Theme" })).toBeTruthy();
    expect((view.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(true);
    expect(useWorkspace.getState().drafts).toEqual({ example: "Unsent draft" });
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(view.getByRole("button", { name: "Settings" })).toBe(trigger);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    useTheme.setState({ theme });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
