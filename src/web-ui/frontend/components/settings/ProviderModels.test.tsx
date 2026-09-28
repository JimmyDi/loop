import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { useState } from "react";

import type { ProviderConfig, ProviderModel } from "../../../shared/provider";
import { i18n } from "../../i18n/setup";
import { ProviderModels } from "./ProviderModels";

test("fetch adds every model, preserves edits, deduplicates and allows deleting the last model", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  let selected: ProviderModel[] = [];
  let fail = false;
  let empty = false;
  const config: ProviderConfig = {
    id: "example",
    kind: "custom",
    name: "Example",
    baseUrl: "https://example.com/v1",
    api: "openai-responses",
    authentication: "apiKey",
    apiKey: "test-only",
    models: [{ id: "manual", name: "Edited name", contextWindow: 8192 }, { id: "" }],
  };
  const Editor = () => {
    const [models, setModels] = useState(config.models);
    return (
      <ProviderModels
        value={models}
        config={{ ...config, models }}
        existing={false}
        onChange={(next) => {
          selected = next;
          setModels(next);
        }}
      />
    );
  };
  globalThis.fetch = (async (_url, init) => {
    expect(JSON.parse(String(init?.body)).apiKey).toBe("test-only");
    return fail
      ? Response.json({ code: "provider_discovery_failed" }, { status: 400 })
      : Response.json(
          empty
            ? []
            : [
                { id: "one", name: "One", contextWindow: 8192, maxTokens: 4096 },
                { id: "two", name: "Two" },
                { id: "manual", name: "Manual" },
                { id: "one", name: "Duplicate" },
              ],
        );
  }) as typeof fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(<Editor />);
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Fetch available models" })),
    );
    await waitFor(() => expect(view.getByDisplayValue("One")).toBeTruthy());
    expect(selected.map((model) => model.id)).toEqual(["manual", "one", "two"]);
    expect(selected[0]).toEqual(config.models[0]);
    expect(selected[1]).toMatchObject({ contextWindow: 8192, maxTokens: 4096 });
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(view.queryByRole("button", { name: "Add selected" })).toBeNull();
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Fetch available models" })),
    );
    expect(selected).toHaveLength(3);
    fireEvent.click(view.getByRole("button", { name: "Remove model one" }));
    expect(selected.map((model) => model.id)).toEqual(["manual", "two"]);
    empty = true;
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Fetch available models" })),
    );
    expect(view.getByRole("status").textContent).toContain("No models found");
    expect(selected.map((model) => model.id)).toEqual(["manual", "two"]);
    fail = true;
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Fetch available models" })),
    );
    await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
    expect(selected.map((model) => model.id)).toEqual(["manual", "two"]);
    fireEvent.click(view.getByRole("button", { name: "Remove model two" }));
    fireEvent.click(view.getByRole("button", { name: "Remove model manual" }));
    expect(selected).toEqual([]);
    fireEvent.click(view.getByRole("button", { name: /Add model/ }));
    expect(selected).toEqual([{ id: "" }]);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
