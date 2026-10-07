import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { PluginSearch } from "./PluginSearch";

test("shared search preserves labels and controlled values across plugin catalogs", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const onChange = vi.fn();
  try {
    const view = render(<PluginSearch label="Search MCPs" value="example" onChange={onChange} />);
    expect((view.getByRole("searchbox", { name: "Search MCPs" }) as HTMLInputElement).value).toBe(
      "example",
    );
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "other" } });
    expect(onChange).toHaveBeenCalledWith("other");
    view.rerender(<PluginSearch label="Search Skills" value="other" onChange={onChange} />);
    const search = view.getByRole("searchbox", { name: "Search Skills" }) as HTMLInputElement;
    expect(search.value).toBe("other");
    expect(search.placeholder).toBe("Search Skills");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
