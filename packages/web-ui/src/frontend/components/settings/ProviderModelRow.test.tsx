import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { useState } from "react";

import type { ProviderModel } from "../../../shared/provider";
import { i18n } from "../../i18n/setup";
import { ProviderModelRow } from "./ProviderModelRow";

test("model rows edit identity, name and capacities and expose an accessible disclosure and delete action", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  let value: ProviderModel = { id: "one", name: "One", contextWindow: 8192, maxTokens: 4096 };
  let removed = false;
  const Editor = () => {
    const [model, setModel] = useState(value);
    return (
      <ProviderModelRow
        model={model}
        index={0}
        onChange={(patch) => {
          value = { ...value, ...patch };
          setModel(value);
        }}
        onRemove={() => {
          removed = true;
        }}
      />
    );
  };
  try {
    await i18n.changeLanguage("en");
    const view = render(<Editor />);
    const toggle = view.getByRole("button", { name: "Model options for one" });
    const details = view.container.querySelector(".provider-model-capacity") as HTMLElement;
    expect(toggle.getAttribute("aria-controls")).toBe(details.id);
    expect(details.hidden).toBe(true);
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle);
    expect(details.hidden).toBe(false);
    fireEvent.change(view.getByLabelText("Model ID"), { target: { value: "renamed" } });
    fireEvent.change(view.getByLabelText("Display name"), { target: { value: "Renamed" } });
    fireEvent.change(view.getByLabelText("Context window"), { target: { value: "16384" } });
    fireEvent.change(view.getByLabelText("Maximum output tokens"), { target: { value: "8192" } });
    expect(value).toEqual({
      id: "renamed",
      name: "Renamed",
      contextWindow: 16384,
      maxTokens: 8192,
    });
    fireEvent.change(view.getByLabelText("Maximum output tokens"), { target: { value: "" } });
    expect(value.maxTokens).toBeUndefined();
    fireEvent.click(view.getByRole("button", { name: "Model options for renamed" }));
    expect(details.hidden).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Remove model renamed" }));
    expect(removed).toBe(true);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
