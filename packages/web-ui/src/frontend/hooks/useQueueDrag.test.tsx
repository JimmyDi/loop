import { expect, test } from "vitest";

import { useQueueDrag } from "./useQueueDrag";

test("dragging previews slots around midpoints and commits only on drop; cancellation and stale rows clear it", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const moves: Array<{ id: string; beforeId?: string }> = [];
  const Host = ({ ids, disabled = false }: { ids: string[]; disabled?: boolean }) => {
    const drag = useQueueDrag(ids, disabled, (id, beforeId) => moves.push({ id, beforeId }));
    return (
      <ol onDragOver={drag.over} onDrop={drag.drop}>
        {ids.map((id) => (
          <li
            key={id}
            data-queue-id={id}
            data-dragged={id === drag.id}
            style={{ transform: "translateY(" + drag.offset(id) + "px)" }}
          >
            <button
              type="button"
              draggable
              onDragStart={(event) => drag.start(event, id)}
              onDragEnd={drag.cancel}
            >
              {id}
            </button>
          </li>
        ))}
      </ol>
    );
  };
  try {
    const ui = render(<Host ids={["a", "b", "c"]} />);
    const list = ui.getByRole("list");
    Object.defineProperty(list, "getBoundingClientRect", {
      value: () => ({ top: 0, bottom: 120, height: 120 }),
    });
    for (const [index, row] of ui.getAllByRole("listitem").entries())
      Object.defineProperty(row, "getBoundingClientRect", {
        value: () => ({ top: index * 40, height: 40, width: 320 }),
      });
    const row = (id: string) => ui.getByRole("button", { name: id }).closest("li")!;
    const start = (id: string) => fireEvent.dragStart(ui.getByRole("button", { name: id }));
    start("a");
    expect(document.querySelectorAll(".queue-drag-preview")).toHaveLength(1);
    fireEvent(list, new globalThis.window.MouseEvent("dragover", { bubbles: true, clientY: 61 }));
    expect(row("a").style.transform).toBe("translateY(40px)");
    expect(row("b").style.transform).toBe("translateY(-40px)");
    expect(row("c").style.transform).toBe("translateY(0px)");
    expect(moves).toEqual([]);
    await act(async () => fireEvent.drop(list));
    expect(moves).toEqual([{ id: "a", beforeId: "c" }]);
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    start("c");
    fireEvent(list, new globalThis.window.MouseEvent("dragover", { bubbles: true, clientY: 19 }));
    await act(async () => fireEvent.drop(list));
    expect(moves.at(-1)).toEqual({ id: "c", beforeId: "a" });
    start("a");
    fireEvent(list, new globalThis.window.MouseEvent("dragover", { bubbles: true, clientY: 120 }));
    await act(async () => fireEvent.drop(list));
    expect(moves.at(-1)).toEqual({ id: "a", beforeId: undefined });
    const count = moves.length;
    start("b");
    await act(async () => fireEvent.drop(list));
    expect(moves).toHaveLength(count);
    start("a");
    fireEvent(list, new globalThis.window.MouseEvent("dragover", { bubbles: true, clientY: 120 }));
    fireEvent.dragEnd(ui.getByRole("button", { name: "a" }));
    expect(moves).toHaveLength(count);
    expect(row("b").style.transform).toBe("translateY(0px)");
    start("c");
    ui.rerender(<Host ids={["a", "b"]} />);
    fireEvent.drop(list);
    expect(moves).toHaveLength(count);
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    start("a");
    ui.rerender(<Host ids={["a", "b"]} disabled />);
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    fireEvent.drop(list);
    expect(moves).toHaveLength(count);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
