import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

const ESTIMATE = 160;
const OVERSCAN = 800;

export const useVirtualRows = (
  keys: readonly string[],
  viewport: RefObject<HTMLDivElement | null>,
  pinned: readonly number[],
  list: RefObject<HTMLDivElement | null>,
) => {
  const indicesByKey = useMemo(() => new Map(keys.map((key, index) => [key, index])), [keys]);
  const heights = useRef(new Map<string, number>());
  const nodes = useRef(new Map<string, HTMLElement>());
  const [revision, update] = useState(0);
  const [position, setPosition] = useState({ top: Infinity, height: 600 });

  const offsets = useMemo(() => {
    const offsets = [0];
    for (const key of keys) offsets.push(offsets.at(-1)! + (heights.current.get(key) ?? ESTIMATE));
    return offsets;
  }, [keys, revision]);
  const sync = () => {
    const element = viewport.current;
    const content = list.current;
    if (!element || !content) return;
    const top = element.getBoundingClientRect().top - content.getBoundingClientRect().top;
    setPosition((previous) =>
      previous.top === top && previous.height === (element.clientHeight || 600)
        ? previous
        : { top, height: element.clientHeight || 600 },
    );
  };
  const measureRows = (elements: readonly HTMLElement[]) => {
    const element = viewport.current;
    if (!element) return;
    let changed = false;
    let adjustment = 0;
    for (const node of elements) {
      const index = indicesByKey.get(node.dataset.rowKey!) ?? -1;
      const rect = node.getBoundingClientRect();
      if (index < 0 || rect.height <= 0) continue;
      const height = Math.max(40, rect.height);
      const old = heights.current.get(node.dataset.rowKey!) ?? ESTIMATE;
      if (Math.abs(height - old) < 0.5) continue;
      heights.current.set(node.dataset.rowKey!, height);
      if (
        !list.current?.parentElement?.closest(".virtual-row") &&
        rect.bottom < element.getBoundingClientRect().top
      )
        adjustment += height - old;
      changed = true;
    }
    if (changed) {
      element.scrollTop += adjustment;
      update((value) => value + 1);
    }
  };
  // Real row heights and programmatic scrolls must be reconciled before paint.
  // Waiting for ResizeObserver can select a window beyond the estimated list.
  useLayoutEffect(() => {
    measureRows([...nodes.current.values()]);
    sync();
  });
  // Parent refs are assigned after child layout effects on the first mount.
  // Bind after the whole tree commits so scrolling always updates the window.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    sync();
    element.addEventListener("scroll", sync, { passive: true });
    const Observer = element.ownerDocument.defaultView?.ResizeObserver;
    const resize = Observer ? new Observer(sync) : undefined;
    resize?.observe(element);
    if (list.current) resize?.observe(list.current);
    return () => {
      element.removeEventListener("scroll", sync);
      resize?.disconnect();
    };
  }, [viewport]);
  useLayoutEffect(() => {
    const Observer = viewport.current?.ownerDocument.defaultView?.ResizeObserver;
    if (!Observer) return;
    const observer = new Observer((entries) => {
      measureRows(entries.map((entry) => entry.target as HTMLElement));
      sync();
    });
    for (const node of nodes.current.values()) observer.observe(node);
    return () => observer.disconnect();
  });
  const rawTop = Number.isFinite(position.top)
    ? position.top
    : Math.max(0, offsets.at(-1)! - position.height);
  const nested = !!list.current?.parentElement?.closest(".virtual-row");
  const top = nested
    ? rawTop
    : Math.max(0, Math.min(rawTop, Math.max(0, offsets.at(-1)! - position.height)));
  const selected = new Set(pinned.filter((index) => index >= 0 && index < keys.length));
  for (const [key, node] of nodes.current)
    if (node.contains(node.ownerDocument.activeElement)) selected.add(indicesByKey.get(key) ?? -1);
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle + 1]! <= top - OVERSCAN) low = middle + 1;
    else high = middle;
  }
  for (
    let index = low;
    index < keys.length && offsets[index]! < top + position.height + OVERSCAN;
    index++
  )
    selected.add(index);
  if (keys.length <= 20 && !viewport.current?.clientHeight)
    keys.forEach((_, index) => selected.add(index));
  const indices = [...selected].filter((index) => index >= 0).sort((a, b) => a - b);
  const measure = (key: string, node: HTMLDivElement | null) => {
    if (node) nodes.current.set(key, node);
    else nodes.current.delete(key);
  };
  return { indices, offsets, measure };
};
