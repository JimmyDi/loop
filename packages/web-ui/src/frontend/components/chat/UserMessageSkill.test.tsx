import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { UserMessageSkill } from "./UserMessageSkill";

test("saved skill descriptions open on hover or focus and dismiss without moving message text", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const fetch = vi.fn();
  globalThis.fetch = fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <UserMessageSkill
        workspaceId="example-project"
        skill={{ id: "review", name: "Review", description: "<script>Review source</script>" }}
      />,
    );
    const trigger = view.getByRole("button", { name: "Review" });
    expect(trigger.hasAttribute("title")).toBe(false);
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(trigger);
    const tooltip = view.getByRole("tooltip");
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.textContent).toBe("<script>Review source</script>");
    expect(tooltip.querySelector("script")).toBeNull();
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(tooltip);
    fireEvent.scroll(tooltip);
    expect(view.getByRole("tooltip")).toBe(tooltip);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(trigger);
    expect(view.getByRole("tooltip").textContent).toContain("Review source");
    fireEvent.scroll(document.body);
    expect(view.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(trigger);
    fireEvent.blur(trigger);
    await waitFor(() => expect(view.queryByRole("tooltip")).toBeNull());
    fireEvent.click(trigger);
    expect(view.getByRole("tooltip")).toBeTruthy();
    window.dispatchEvent(new window.Event("resize"));
    await waitFor(() => expect(view.queryByRole("tooltip")).toBeNull());
    expect(trigger.textContent).toBe("Review");
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("legacy descriptions resolve by exact source only on demand and handle missing sources", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const fetch = vi.fn(async () =>
    Response.json({
      skills: [
        { id: "other", name: "Review", description: "Wrong source" },
        { id: "exact", name: "Review", description: "Exact description" },
      ],
    }),
  );
  globalThis.fetch = fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <UserMessageSkill workspaceId="example project" skill={{ id: "exact", name: "Review" }} />,
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.mouseEnter(view.getByRole("button", { name: "Review" }));
    await waitFor(() => expect(view.getByRole("tooltip").textContent).toBe("Exact description"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/settings/skills?workspaceId=example%20project",
      expect.objectContaining({ signal: expect.anything() }),
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.mouseEnter(view.getByRole("button", { name: "Review" }));
    expect(fetch).toHaveBeenCalledOnce();
    view.unmount();
    const missing = render(
      <UserMessageSkill workspaceId="example" skill={{ id: "missing", name: "Removed" }} />,
    );
    fireEvent.focus(missing.getByRole("button", { name: "Removed" }));
    await waitFor(() =>
      expect(missing.getByRole("tooltip").textContent).toBe("Skill description is unavailable."),
    );
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
