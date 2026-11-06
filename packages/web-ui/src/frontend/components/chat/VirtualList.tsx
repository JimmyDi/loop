import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import { useVirtualRows } from "../../hooks/useVirtualRows";
import "./VirtualList.css";

export type VirtualRow = { key: string; render: () => ReactNode };

export const VirtualList = ({
  rows,
  viewport,
  pinned = [],
  target,
  onTarget,
}: {
  rows: readonly VirtualRow[];
  viewport: RefObject<HTMLDivElement | null>;
  pinned?: readonly number[];
  target?: { key: string; request: number };
  onTarget?: () => void;
}) => {
  const keys = useMemo(() => rows.map((row) => row.key), [rows]);
  const list = useRef<HTMLDivElement>(null);
  const aligned = useRef<{ target: typeof target; pass: number }>({ target: undefined, pass: 0 });
  const [, reconcile] = useState(0);
  const targetIndex = target ? keys.indexOf(target.key) : -1;
  const virtual = useVirtualRows(keys, viewport, [...pinned, targetIndex], list);
  useLayoutEffect(() => {
    const element = viewport.current;
    const node = list.current?.querySelector<HTMLElement>('[data-row-key="' + target?.key + '"]');
    if (!element || !node || targetIndex < 0) return;
    if (aligned.current.target !== target) aligned.current = { target, pass: 0 };
    if (aligned.current.pass >= 2) return;
    const padding =
      Number.parseFloat(
        element.ownerDocument.defaultView?.getComputedStyle(element).paddingTop ?? "",
      ) || 0;
    element.scrollTop +=
      node.getBoundingClientRect().top - element.getBoundingClientRect().top - padding;
    const content = list.current?.parentElement;
    if (content) {
      const needed =
        node.getBoundingClientRect().top -
        content.getBoundingClientRect().top +
        element.clientHeight;
      content.style.minHeight =
        Math.max(Number.parseFloat(content.style.minHeight) || 0, needed) + "px";
      element.scrollTop +=
        node.getBoundingClientRect().top - element.getBoundingClientRect().top - padding;
    }
    const EventClass = element.ownerDocument.defaultView?.Event;
    if (EventClass) element.dispatchEvent(new EventClass("scroll"));
    // Reconcile the newly mounted neighbourhood's measured heights before releasing the target.
    if (++aligned.current.pass >= 2) onTarget?.();
    else reconcile((value) => value + 1);
  });
  let end = 0;
  return (
    <div className="virtual-list" ref={list}>
      {virtual.indices.map((index) => {
        const gap = virtual.offsets[index]! - virtual.offsets[end]!;
        end = index + 1;
        const row = rows[index]!;
        return (
          <Fragment key={row.key}>
            {gap > 0 && (
              <div className="virtual-spacer" aria-hidden="true" style={{ height: gap }} />
            )}
            <div
              className="virtual-row"
              data-row-key={row.key}
              ref={(node) => virtual.measure(row.key, node)}
            >
              {row.render()}
            </div>
          </Fragment>
        );
      })}
      <div
        className="virtual-spacer"
        aria-hidden="true"
        style={{ height: virtual.offsets.at(-1)! - virtual.offsets[end]! }}
      />
    </div>
  );
};
