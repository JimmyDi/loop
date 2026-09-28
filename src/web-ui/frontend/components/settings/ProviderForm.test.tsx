import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ProviderForm } from "./ProviderForm";
import { Window } from "happy-dom";
import { i18n } from "../../i18n/setup";
import type { ProviderConfig } from "../../../shared/provider";

test("fetch populates editable catalog models, and saving excludes deleted models without changing the gateway", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  let saved: ProviderConfig | undefined;
  let requests = 0;
  let respond!: (response: Response) => void;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    requests++;
    expect(JSON.parse(String(init?.body)).id).toBe("openai");
    return await new Promise<Response>((resolve) => {
      respond = resolve;
    });
  }) as unknown as typeof fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <ProviderForm
        initial={{
          id: "",
          name: "Gateway",
          kind: "custom",
          baseUrl: "http://localhost:8080/v1",
          api: "openai-completions",
          authentication: "none",
          hasApiKey: false,
          models: [{ id: "" }],
        }}
        existing={false}
        catalog={[
          {
            id: "openai",
            name: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            models: [
              { id: "gpt-5.5", name: "GPT-5.5", contextWindow: 128000, maxTokens: 8192 },
              { id: "gpt-4", name: "GPT-4", contextWindow: 8192, maxTokens: 8192 },
            ],
          },
        ]}
        usedIds={[]}
        save={async (value) => {
          saved = value;
        }}
        onClose={() => {}}
      />,
    );
    expect(view.queryByRole("checkbox", { name: "GPT-5.5" })).toBeNull();
    fireEvent.change(view.getByLabelText("Provider ID"), { target: { value: "openai" } });
    expect(view.queryByDisplayValue("GPT-5.5")).toBeNull();
    expect(view.getByText(/availability has not been checked/)).toBeTruthy();
    expect(requests).toBe(0);
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Fetch available models" })),
    );
    expect(requests).toBe(1);
    expect((view.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () =>
      respond(
        Response.json([
          { id: "gpt-5.5", name: "GPT-5.5", contextWindow: 128000, maxTokens: 8192 },
          { id: "gpt-4", name: "GPT-4", contextWindow: 8192, maxTokens: 8192 },
        ]),
      ),
    );
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(view.getByDisplayValue("GPT-4")).toBeTruthy();
    fireEvent.change(view.getByDisplayValue("GPT-5.5"), { target: { value: "Gateway model" } });
    fireEvent.click(view.getByRole("button", { name: "Remove model gpt-4" }));
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Save" })));
    expect(saved).toMatchObject({
      id: "openai",
      kind: "custom",
      baseUrl: "http://localhost:8080/v1",
      api: "openai-completions",
      authentication: "none",
      models: [{ id: "gpt-5.5", name: "Gateway model", contextWindow: 128000, maxTokens: 8192 }],
    });
    expect(saved?.models).toHaveLength(1);
    fireEvent.change(view.getByLabelText("Provider ID"), { target: { value: "unmatched" } });
    expect(view.queryByText(/Fetch adds the OpenAI catalog/)).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("custom provider form exposes protocol, model options and write-only credentials", () => {
  const html = renderToStaticMarkup(
    <ProviderForm
      initial={{
        id: "gateway",
        kind: "custom",
        name: "Gateway",
        baseUrl: "https://example.com/v1",
        api: "openai-completions",
        models: [{ id: "gpt-5.5" }],
        authentication: "apiKey",
        hasApiKey: true,
      }}
      existing={true}
      catalog={[]}
      usedIds={[]}
      save={async () => {}}
      onClose={() => {}}
    />,
  );

  for (const text of [
    "Provider name",
    "Base URL",
    "Model ID",
    "gpt-5.5",
    "API key",
    "No authentication",
    'type="password"',
  ])
    expect(html).toContain(text);
});
