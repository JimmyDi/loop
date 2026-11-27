import { Window } from "happy-dom";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { DailyTimeField } from "./DailyTimeField";

test("keeps an exact typed minute and submits the selected quarter hour", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const ui = render(
      <form>
        <DailyTimeField initial="09:37" />
      </form>,
    );
    const input = ui.container.querySelector("input")!;
    expect(input.value).toBe("09:37");
    fireEvent.click(ui.getByRole("button"));
    expect(ui.getAllByRole("option")).toHaveLength(97);
    fireEvent.click(ui.getAllByRole("option").at(-1)!);
    expect(input.value).toBe("23:45");
    fireEvent.change(input, { target: { value: "11:08" } });
    expect(new window.FormData(ui.container.querySelector("form") as never).getAll("time")).toEqual(
      ["11:08"],
    );
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
