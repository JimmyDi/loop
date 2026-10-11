import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

type Drag = {
  id: string;
  beforeId?: string;
  rows: Array<{ id: string; top: number; height: number }>;
  preview?: HTMLElement;
};

export const useQueueDrag = (
  ids: readonly string[],
  disabled: boolean,
  move: (id: string, beforeId?: string) => void,
) => {
  const active = useRef<Drag>(undefined);
  const [drag, setDrag] = useState<Drag>();
  const revision = ids.join(",");
  const cancel = () => {
    active.current?.preview?.remove();
    active.current = undefined;
    setDrag(undefined);
  };
  useEffect(() => {
    cancel();
    return () => active.current?.preview?.remove();
  }, [revision, disabled]);

  const start = (event: DragEvent<HTMLButtonElement>, id: string) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    const row = event.currentTarget.closest("li")!;
    const list = row.parentElement!;
    const listTop = list.getBoundingClientRect().top;
    const rows = [...list.children].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: (element as HTMLElement).dataset.queueId!,
        top: rect.top - listTop + list.scrollTop,
        height: rect.height,
      };
    });
    const preview = row.cloneNode(true) as HTMLElement;
    preview.className = "queue-drag-preview";
    preview.style.width = row.getBoundingClientRect().width + "px";
    preview.setAttribute("aria-hidden", "true");
    preview.inert = true;
    list.ownerDocument.body.append(preview);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      event.dataTransfer.setDragImage(preview, 12, rows.find((item) => item.id === id)!.height / 2);
    }
    active.current = { id, beforeId: ids[ids.indexOf(id) + 1], rows, preview };
    setDrag(active.current);
  };
  const over = (event: DragEvent<HTMLOListElement>) => {
    const current = active.current;
    if (!current || disabled) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const list = event.currentTarget;
    const rect = list.getBoundingClientRect();
    const y = event.clientY - rect.top + list.scrollTop;
    const beforeId = current.rows.find(
      (row) => row.id !== current.id && y < row.top + row.height / 2,
    )?.id;
    if (beforeId !== current.beforeId) {
      active.current = { ...current, beforeId };
      setDrag(active.current);
    }
    const edge = Math.min(32, rect.height / 4);
    if (event.clientY < rect.top + edge) list.scrollTop -= 10;
    else if (event.clientY > rect.bottom - edge) list.scrollTop += 10;
  };
  const drop = (event: DragEvent<HTMLOListElement>) => {
    const current = active.current;
    if (!current) return;
    event.preventDefault();
    if (
      !disabled &&
      ids.includes(current.id) &&
      current.beforeId !== ids[ids.indexOf(current.id) + 1]
    )
      move(current.id, current.beforeId);
    cancel();
  };
  const offset = (id: string): number => {
    if (!drag) return 0;
    const original = drag.rows.find((row) => row.id === id);
    if (!original) return 0;
    const order = drag.rows.filter((row) => row.id !== drag.id);
    const index = drag.beforeId ? order.findIndex((row) => row.id === drag.beforeId) : order.length;
    order.splice(index, 0, drag.rows.find((row) => row.id === drag.id)!);
    const top =
      drag.rows[0]!.top +
      order
        .slice(
          0,
          order.findIndex((row) => row.id === id),
        )
        .reduce((sum, row) => sum + row.height, 0);
    return top - original.top;
  };
  return { id: drag?.id, start, over, drop, cancel, offset };
};
