import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import type { McpValue } from "../../../shared/mcp";
import { McpRows } from "./McpRows";

test("write-only rows retain saved values, support replacement and remove exactly one row", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let rows: McpValue[] = [{ key: "EXAMPLE", value: "", saved: true }];
  try {
    const content = () => (
      <McpRows
        label="Environment variables"
        pair
        secret
        rows={rows}
        onChange={(value) => {
          rows = value;
        }}
      />
    );
    const view = render(content());
    const input = view.getByLabelText("Environment variables Value 1") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.value).toBe("");
    expect(input.placeholder).toContain("Saved");
    fireEvent.change(input, { target: { value: "synthetic-value" } });
    expect(rows[0]!.value).toBe("synthetic-value");
    view.rerender(content());
    fireEvent.click(view.getByRole("button", { name: "Remove Environment variables row 1" }));
    expect(rows).toEqual([]);
    view.rerender(content());
    const firstKey = view.getByLabelText("Environment variables Key 1") as HTMLInputElement;
    expect(firstKey.value).toBe("");
    expect(firstKey.required).toBe(false);
    fireEvent.change(firstKey, { target: { value: "EXAMPLE_NEXT" } });
    expect(rows).toEqual([{ key: "EXAMPLE_NEXT", value: "", saved: false }]);
    view.rerender(content());
    fireEvent.click(view.getByRole("button", { name: /Add Environment variables/ }));
    expect(rows).toHaveLength(2);
    view.rerender(content());
    fireEvent.click(view.getByRole("button", { name: "Remove Environment variables row 1" }));
    expect(rows).toEqual([{ key: "", value: "" }]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
