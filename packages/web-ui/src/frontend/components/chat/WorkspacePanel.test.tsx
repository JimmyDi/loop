import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { PanelTabs } from "./PanelTabs";
import { WorkspacePanel } from "./WorkspacePanel";
import { usePanelTabs } from "../../hooks/usePanelTabs";
import { i18n } from "../../i18n/setup";

test("empty panel supports generic tabs, switching, closing and hide/reopen", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const View = ({ scope }: { scope: string }) => {
    const tabs = usePanelTabs<string>(scope);
    return (
      <>
        <button onClick={tabs.toggle}>Toggle</button>
        <button onClick={() => tabs.add({ id: "a", title: "First", content: "First content" })}>
          Add first
        </button>
        <button onClick={() => tabs.add({ id: "b", title: "Second", content: "Other content" })}>
          Add second
        </button>
        {tabs.open && (
          <>
            <PanelTabs {...tabs} />
            <button onClick={tabs.hide}>Close panel</button>
            <WorkspacePanel {...tabs} renderContent={(content) => <p>{content}</p>} />
          </>
        )}
      </>
    );
  };
  try {
    await i18n.changeLanguage("en");
    const view = render(<View scope="one" />);
    fireEvent.click(view.getByText("Toggle"));
    expect(view.queryAllByRole("tab")).toHaveLength(0);
    fireEvent.click(view.getByText("Add first"));
    fireEvent.click(view.getByText("Add second"));
    expect(view.getAllByRole("tab")).toHaveLength(2);
    expect(view.getByRole("tabpanel").textContent).toBe("Other content");
    fireEvent.keyDown(view.getByRole("tab", { name: "Second" }), { key: "ArrowLeft" });
    expect(view.getByRole("tabpanel").textContent).toBe("First content");
    fireEvent.click(view.getByText("Add first"));
    expect(view.getAllByRole("tab")).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Close panel" }));
    fireEvent.click(view.getByText("Toggle"));
    expect(view.getAllByRole("tab")).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Close First tab" }));
    expect(view.getByRole("tabpanel").textContent).toBe("Other content");
    fireEvent.click(view.getByRole("button", { name: "Close Second tab" }));
    expect(view.queryAllByRole("tab")).toHaveLength(0);
    view.rerender(<View scope="two" />);
    expect(view.queryByRole("complementary")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
