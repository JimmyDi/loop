import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { AppShell } from "../layout/AppShell";

test("Settings opens General outside the mobile drawer and restores focus without closing the drawer", async () => {
  const window = new Window({ width: 390 });
  const previous = { window: globalThis.window, document: globalThis.document };
  const language = i18n.language;
  const state = useWorkspace.getState();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  client.setQueryData(["projects"], []);
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");

  try {
    await i18n.changeLanguage("en");
    useWorkspace.setState({
      sidebar: true,
      active: undefined,
      tabs: [],
      drafts: { example: "Unsent draft" },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <AppShell />
      </QueryClientProvider>,
    );
    const trigger = view.getByRole("button", { name: "Settings" });

    expect(view.getByRole("button", { name: "Model settings" })).toBeTruthy();
    expect(view.queryByRole("combobox", { name: "Language" })).toBeNull();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = view.getByRole("dialog", { name: "Settings" });

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.parentElement).toBe(document.body);
    expect(view.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getAllByRole("tab")).toHaveLength(1);
    expect(view.getByRole("tabpanel", { name: "General" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Language English" }));
    await act(async () => fireEvent.click(view.getByRole("option", { name: "中文" })));
    expect(view.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(useWorkspace.getState().drafts).toEqual({ example: "Unsent draft" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new window.Event("cancel", { cancelable: true }) as unknown as Event);
    expect(view.queryByRole("dialog")).toBeNull();
    expect(useWorkspace.getState().sidebar).toBe(true);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(view.getByRole("button", { name: "关闭" }));
    expect(view.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
