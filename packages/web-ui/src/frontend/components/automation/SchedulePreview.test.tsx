// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react/pure";
import { expect, test, vi } from "vitest";
import "../../i18n/setup";
import { ScheduleForm } from "./ScheduleForm";

test("automatically previews the current time and refreshes it after an edit", async () => {
  const fetchPreview = vi
    .fn(async () => Response.json([1000, 2000, 3000]))
    .mockResolvedValueOnce(Response.json([1000, 2000, 3000, 4000]));
  vi.stubGlobal("fetch", fetchPreview);
  try {
    const ui = render(
      <ScheduleForm projects={[]} busy={false} cancel={() => {}} save={() => {}} />,
    );
    const heading = ui.getByRole("heading", { name: "Next runs" });
    expect(ui.getByRole("status").textContent).toBe("Calculating run times…");
    expect(await ui.findAllByRole("listitem")).toHaveLength(3);
    expect(ui.getByRole("note", { name: "More runs follow" }).textContent).toBe("…");
    expect(ui.container.querySelectorAll("time")).toHaveLength(3);
    expect(ui.queryByRole("button", { name: /preview/i })).toBeNull();
    fireEvent.change(ui.container.querySelector('input[name="time"]')!, {
      target: { value: "13:07" },
    });
    expect(ui.getByRole("heading", { name: "Next runs" })).toBe(heading);
    expect(ui.getByRole("status").textContent).toBe("Calculating run times…");
    expect(await ui.findAllByRole("listitem")).toHaveLength(3);
    expect(ui.getByRole("heading", { name: "Next runs" })).toBe(heading);
    expect(ui.queryByRole("note")).toBeNull();
    await waitFor(() =>
      expect(fetchPreview).toHaveBeenCalledWith(
        "/api/schedules/preview",
        expect.objectContaining({ body: expect.stringContaining('"expression":"7 13 * * *"') }),
      ),
    );
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});
