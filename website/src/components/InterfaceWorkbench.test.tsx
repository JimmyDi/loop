import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { InterfaceWorkbench } from "./InterfaceWorkbench";

afterEach(cleanup);

it("selects one entry at a time and retains its exact command and documentation", () => {
  const { container } = render(<InterfaceWorkbench />);
  for (const name of ["CLI", "SDK", "Web"]) {
    fireEvent.click(screen.getByRole("button", { name }));
    const panels = Array.from(container.querySelectorAll<HTMLElement>('[id^="panel-"]'));
    expect(panels.filter((panel) => !panel.hidden).map((panel) => panel.id)).toEqual([
      "panel-" + name.toLowerCase(),
    ]);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
  }
  expect(container.querySelector("#panel-sdk code")?.textContent).toContain(
    'from "@loop-harness/loop";',
  );
  expect(container.querySelector("#panel-cli a")?.getAttribute("target")).toBe("_blank");
});
