import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { GeneralSettings } from "../../../shared/settings";
import { i18n } from "../../i18n/setup";
import { SettingsDialog } from "./SettingsDialog";

test("General saves defaults after confirmation, preserves them on failure, and keeps nested dialog cancellation local", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, createEvent, act, cleanup, within, waitFor } = await import(
    "@testing-library/react/pure"
  );
  let savedPreset = "read-only";
  let firstLoad = true;
  let completeLoad!: (response: Response) => void;
  let completeSave!: (response: Response) => void;
  let closed = 0;
  const requests: unknown[] = [];
  globalThis.fetch = ((url, options) => {
    expect(String(url)).toBe("/api/settings/general");
    if (options?.method === "PUT") {
      requests.push(JSON.parse(String(options.body)));
      return new Promise<Response>((resolve) => {
        completeSave = resolve;
      });
    }
    if (firstLoad) {
      firstLoad = false;
      return new Promise<Response>((resolve) => {
        completeLoad = resolve;
      });
    }
    return Promise.resolve(Response.json({ permissionPreset: savedPreset }));
  }) as typeof fetch;
  const settings = (key = "first") => (
    <QueryClientProvider client={client}>
      <SettingsDialog
        key={key}
        onClose={() => {
          closed++;
        }}
      />
    </QueryClientProvider>
  );
  try {
    await i18n.changeLanguage("en");
    const ui = render(settings());
    const trigger = () => ui.getByRole("button", { name: /^Permission / }) as HTMLButtonElement;
    expect(trigger().disabled).toBe(true);
    await act(async () => {
      completeLoad(
        Response.json({ code: "load_failed", message: "Cannot read settings" }, { status: 500 }),
      );
    });
    await waitFor(() =>
      expect(ui.getByRole("alert").textContent).toContain("Cannot read settings"),
    );
    expect(trigger().disabled).toBe(true);
    fireEvent.click(ui.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(trigger().disabled).toBe(false));
    expect(trigger().textContent).toContain("Read only");
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const read = ui.getByRole("menuitemradio", { name: "Read only" });
    expect(read.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(read);
    fireEvent.click(read);
    expect(requests).toHaveLength(0);
    fireEvent.click(trigger());
    fireEvent.click(ui.getByRole("menuitemradio", { name: "Workspace write" }));
    await waitFor(() => expect(requests).toEqual([{ permissionPreset: "workspace-write" }]));
    expect(trigger().disabled).toBe(true);
    expect(trigger().textContent).toContain("Read only");
    savedPreset = "workspace-write";
    await act(async () => {
      completeSave(Response.json({ permissionPreset: savedPreset }));
    });
    await waitFor(() => expect(trigger().textContent).toContain("Workspace write"));
    expect(ui.queryByRole("menu")).toBeNull();
    const openFull = () => {
      fireEvent.click(trigger());
      fireEvent.click(ui.getByRole("menuitemradio", { name: "Full access" }));
      return ui.getByRole("dialog", { name: "Use full access for new sessions?" });
    };
    let confirmation = openFull();
    expect(within(confirmation).getByText(/New Web sessions in every project/)).toBeTruthy();
    expect(requests).toHaveLength(1);
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(ui.getAllByRole("dialog")).toHaveLength(1);
    expect(document.activeElement).toBe(trigger());
    confirmation = openFull();
    fireEvent(
      confirmation,
      createEvent("cancel", confirmation, { bubbles: false, cancelable: true }),
    );
    expect(ui.getAllByRole("dialog")).toHaveLength(1);
    expect(closed).toBe(0);
    expect(requests).toHaveLength(1);
    confirmation = openFull();
    const confirm = within(confirmation).getByRole("button", { name: "Enable full access" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests.at(-1)).toEqual({ permissionPreset: "danger-full-access" });
    expect(trigger().disabled).toBe(true);
    fireEvent(
      confirmation,
      createEvent("cancel", confirmation, { bubbles: false, cancelable: true }),
    );
    expect(ui.getAllByRole("dialog")).toHaveLength(2);
    await act(async () => {
      completeSave(
        Response.json({ code: "save_failed", message: "Cannot save settings" }, { status: 500 }),
      );
    });
    await waitFor(() =>
      expect(within(confirmation).getByRole("alert").textContent).toContain("Cannot save settings"),
    );
    expect(trigger().textContent).toContain("Workspace write");
    expect(ui.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.click(within(confirmation).getByRole("button", { name: "Enable full access" }));
    await waitFor(() => expect(requests).toHaveLength(3));
    savedPreset = "danger-full-access";
    await act(async () => {
      completeSave(Response.json({ permissionPreset: savedPreset }));
    });
    await waitFor(() => expect(ui.getAllByRole("dialog")).toHaveLength(1));
    expect(trigger().textContent).toContain("Full access");
    expect(ui.queryByRole("alert")).toBeNull();
    ui.rerender(settings("reopened"));
    expect(trigger().textContent).toContain("Full access");
    fireEvent.click(trigger());
    fireEvent.click(ui.getByRole("menuitemradio", { name: "Read only" }));
    await waitFor(() => expect(requests).toHaveLength(4));
    expect(ui.getAllByRole("dialog")).toHaveLength(1);
    savedPreset = "read-only";
    await act(async () => {
      completeSave(Response.json({ permissionPreset: savedPreset }));
    });
    await waitFor(() => expect(trigger().textContent).toContain("Read only"));
    expect(client.getQueryData<GeneralSettings>(["general-settings"])).toEqual({
      permissionPreset: "read-only",
    });
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
