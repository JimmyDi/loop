import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { ComposerSkillTokens } from "./ComposerSkillTokens";

test("skill tokens remain static labels when clicked in enabled and disabled inputs", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const skills = [
    { id: "personal-source", name: "Review" },
    { id: "project-source", name: "Review" },
  ];
  try {
    const view = render(<ComposerSkillTokens skills={skills} disabled={false} />);
    const tokens = view.container.querySelectorAll(".composer-skill-token");
    fireEvent.click(tokens[1]!);
    expect(view.getAllByText("Review")).toHaveLength(2);
    expect(view.queryByRole("button")).toBeNull();
    expect(tokens[1]!.hasAttribute("tabindex")).toBe(false);
    expect(tokens[1]!.hasAttribute("title")).toBe(false);
    view.rerender(<ComposerSkillTokens skills={skills} disabled />);
    fireEvent.click(tokens[0]!);
    expect(view.getAllByText("Review")).toHaveLength(2);
    expect(view.container.querySelectorAll("svg")).toHaveLength(2);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
