import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import type { ProviderConfig, ProviderRecord } from "../../../shared/provider";
import { ModelsSettings } from "./ModelsSettings";
import { Modal } from "../ui/Modal";

test("Models manages builtin providers, redacts keys and closes nested dialogs without closing Settings", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup, waitFor, within } = await import(
    "@testing-library/react/pure"
  );
  const language = i18n.language;
  const catalog = [
    {
      id: "deepseek",
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      api: "openai-completions",
      models: [{ id: "deepseek-chat" }],
    },
  ];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let providers: ProviderRecord[] = [];
  let closed = 0;
  const requests: { url: string; method?: string; body?: ProviderConfig }[] = [];
  client.setQueryData(["provider-settings"], { providers, catalog });
  client.setQueryData(["models"], []);
  globalThis.fetch = (async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url: String(url), method: init?.method, body });
    if (init?.method === "POST") {
      const { apiKey: _, ...publicFields } = body;
      providers = [{ ...publicFields, hasApiKey: true }];
    } else if (init?.method === "DELETE") providers = [];
    return Response.json({ providers, catalog });
  }) as typeof fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <QueryClientProvider client={client}>
        <Modal title="Settings" onClose={() => closed++}>
          <ModelsSettings />
        </Modal>
      </QueryClientProvider>,
    );
    expect(view.queryByText("DeepSeek")).toBeNull();
    expect(view.queryByRole("img", { name: "API key required" })).toBeNull();
    expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(view.queryByRole("button", { name: "Delete" })).toBeNull();
    const add = view.getByRole("button", { name: /Add provider/ });
    add.focus();
    fireEvent.click(add);
    const dialog = view.getByRole("dialog", { name: "Add provider" });
    expect(dialog.parentElement).toBe(document.body);
    expect((view.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    fireEvent(
      dialog,
      new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event,
    );
    expect(closed).toBe(0);
    expect(view.queryByRole("dialog", { name: "Add provider" })).toBeNull();
    expect(document.activeElement).toBe(add);
    fireEvent.click(add);
    fireEvent.change(view.getByRole("combobox"), { target: { value: "deepseek" } });
    fireEvent.change(view.getByLabelText("API key"), { target: { value: "test-secret" } });
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Save" })));
    await waitFor(() =>
      expect(view.getByRole("img", { name: "Configured (connection not tested)" })).toBeTruthy(),
    );
    expect(view.getAllByText("DeepSeek")).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      body: { id: "deepseek", kind: "builtin" },
    });
    expect(client.getQueryState(["models"])?.isInvalidated).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    expect((view.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect((view.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    fireEvent.click(view.getByRole("button", { name: "Delete" }));
    const confirmation = within(view.getByRole("dialog", { name: "Delete provider" }));
    await act(async () => fireEvent.click(confirmation.getByRole("button", { name: "Delete" })));
    await waitFor(() => expect(view.queryByRole("dialog", { name: "Delete provider" })).toBeNull());
    expect(view.queryByText("DeepSeek")).toBeNull();
    expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(view.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(requests.at(-1)).toMatchObject({
      method: "DELETE",
      url: "/api/settings/providers/deepseek",
    });
    fireEvent.click(view.getByRole("button", { name: /Add a custom provider/ }));
    expect(view.getByLabelText("Provider ID")).toBeTruthy();
    expect(view.getByRole("combobox", { name: "API protocol" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Fetch available models" })).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage("zh");
    });
    expect(view.queryByText("apiProtocol")).toBeNull();
    expect(view.queryByText("addCustomProvider")).toBeNull();
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
