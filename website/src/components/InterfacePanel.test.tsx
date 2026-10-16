import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { interfaceOptions } from "./interface-options";
import { InterfacePanel } from "./InterfacePanel";

afterEach(cleanup);

it.each(interfaceOptions)(
  "retains the exact command for $name and can hide inactive content",
  (option) => {
    const { container } = render(<InterfacePanel option={option} hidden />);
    expect(container.querySelector<HTMLElement>("[id]")?.hidden).toBe(true);
    expect(container.querySelector("code")?.textContent).toContain(option.command);
    expect(container.querySelectorAll("a")).toHaveLength(option.docs ? 1 : 0);
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("code")?.dataset.language).toBe(
      option.id === "sdk" ? "typescript" : "bash",
    );
    expect(container.querySelector(".comment")).toBeTruthy();
    expect(container.querySelector(".function")).toBeTruthy();
  },
);
