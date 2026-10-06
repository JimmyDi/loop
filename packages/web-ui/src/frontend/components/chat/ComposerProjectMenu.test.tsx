import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ComposerProjectMenu } from "./ComposerProjectMenu";

test("project choices expose selected and inaccessible states plus Add folder", () => {
  const html = renderToStaticMarkup(
    <ComposerProjectMenu
      projects={[
        { id: "p", name: "Example", cwd: "/example" },
        { id: "q", name: "Unavailable", cwd: "/unavailable", accessible: false },
      ]}
      current="p"
      disabled={false}
      onSelect={() => {}}
      onAdd={() => {}}
    />,
  );
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('disabled=""');
  expect(html).toContain("Add folder…");
});

test("search trims and ignores case, keeps Add folder available, and selects matching projects", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const projects = [
    { id: "p", name: "Example", cwd: "/example" },
    { id: "q", name: "Other project", cwd: "/other" },
    { id: "r", name: "Unavailable", cwd: "/unavailable", accessible: false },
  ];
  const onSelect = vi.fn();
  const onAdd = vi.fn();
  try {
    const ui = render(
      <ComposerProjectMenu
        projects={projects}
        disabled={false}
        onSelect={onSelect}
        onAdd={onAdd}
      />,
    );
    const search = ui.getByRole("searchbox", { name: "Search projects" });
    fireEvent.change(search, { target: { value: " eXaM " } });
    expect(ui.queryByRole("menuitemradio", { name: "Other project" })).toBeNull();
    fireEvent.click(ui.getByRole("menuitemradio", { name: "Example" }));
    expect(onSelect).toHaveBeenCalledWith(projects[0]);
    fireEvent.change(search, { target: { value: "missing" } });
    expect(ui.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(ui.getByRole("status").textContent).toBe("No matching projects");
    fireEvent.click(ui.getByRole("menuitem", { name: "Add folder…" }));
    expect(onAdd).toHaveBeenCalledOnce();
    fireEvent.change(search, { target: { value: "" } });
    expect(ui.getAllByRole("menuitemradio")).toHaveLength(3);
    expect(ui.getByRole("menuitemradio", { name: "Unavailable" }).hasAttribute("disabled")).toBe(
      true,
    );
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
