import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { useState } from "react";

import { i18n } from "../../i18n/setup";
import type { ModelSelection, SessionSnapshot } from "../../../shared/protocol";
import { ComposerModelSettings } from "./ComposerModelSettings";

const snapshot: SessionSnapshot = {
  streamId: "stream",
  sessionId: "session",
  workspaceId: "project",
  model: { provider: "example", id: "first", name: "First", efforts: ["default", "low", "high"] },
  effort: "high",
  operation: "idle",
  tools: {},
  state: {
    messages: [],
    isRunning: false,
    hasPendingSave: false,
    outcome: "idle",
    listenerErrors: [],
  },
};

test("composer menu selects effort and models, supports keyboard and preserves selection on failure", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const models = [
    snapshot.model,
    {
      provider: "another",
      providerName: "Another Gateway",
      id: "second",
      name: "Second",
      efforts: [],
    },
  ];
  client.setQueryData(["models"], models);
  const choices: ModelSelection[] = [];
  let failed = false;
  const Editor = ({ disabled = false }: { disabled?: boolean }) => {
    const [current, setCurrent] = useState(snapshot);
    return (
      <QueryClientProvider client={client}>
        <ComposerModelSettings
          snapshot={current}
          disabled={disabled}
          pending={false}
          select={async (choice) => {
            choices.push(choice);
            if (failed) return false;
            setCurrent({
              ...current,
              model: models.find((model) => model.id === choice.id)!,
              effort: choice.effort,
            });
            return true;
          }}
        />
        <button type="button">Outside</button>
      </QueryClientProvider>
    );
  };
  try {
    await i18n.changeLanguage("en");
    const view = render(<Editor />);
    const trigger = view.getByRole("button", { name: "Model settings: First · High" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    const model = view.getByRole("menuitem", { name: /Model First/ });
    expect(document.activeElement).toBe(model);
    fireEvent.keyDown(model, { key: "ArrowDown" });
    expect(document.activeElement).toBe(view.getByRole("menuitem", { name: /Effort High/ }));
    fireEvent.click(document.activeElement!);
    expect(view.getByRole("menuitemradio", { name: "High" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(view.queryByRole("menuitemradio", { name: "Maximum" })).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(view.getByRole("menuitemradio", { name: "Default" }));
    await act(async () => fireEvent.click(view.getByRole("menuitemradio", { name: "Low" })));
    expect(choices.at(-1)).toEqual({ provider: "example", id: "first", effort: "low" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(view.getByRole("menuitem", { name: /Model First/ }));
    expect(view.getByRole("group", { name: "Another Gateway" })).toBeTruthy();
    fireEvent.keyDown(view.getByRole("textbox", { name: "Search models" }), { key: "ArrowUp" });
    expect(document.activeElement).toBe(view.getByRole("menuitemradio", { name: "Second second" }));
    fireEvent.change(view.getByRole("textbox", { name: "Search models" }), {
      target: { value: "gateway" },
    });
    expect(view.queryByRole("menuitemradio", { name: "First first" })).toBeNull();
    failed = true;
    await act(async () =>
      fireEvent.click(view.getByRole("menuitemradio", { name: "Second second" })),
    );
    expect(view.getByRole("button", { name: "Model settings: First · Low" })).toBeTruthy();
    expect(view.getByRole("menu", { name: "Model" })).toBeTruthy();
    failed = false;
    await act(async () =>
      fireEvent.click(view.getByRole("menuitemradio", { name: "Second second" })),
    );
    expect(choices.at(-1)).toEqual({ provider: "another", id: "second", effort: "default" });
    fireEvent.click(view.getByRole("button", { name: "Model settings: Second" }));
    expect(view.queryByRole("menuitem", { name: /Effort/ })).toBeNull();
    fireEvent.keyDown(view.getByRole("menuitem"), { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Model settings: Second" }));
    fireEvent.pointerDown(view.getByRole("button", { name: "Outside" }));
    expect(view.queryByRole("menu")).toBeNull();
    view.rerender(<Editor disabled />);
    expect(
      (view.getByRole("button", { name: "Model settings: Second" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await act(async () => {
      await i18n.changeLanguage("zh");
    });
    expect(view.getByRole("button", { name: "模型配置: Second" })).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
