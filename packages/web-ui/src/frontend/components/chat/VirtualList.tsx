import { Fragment, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { useVirtualRows } from "../../hooks/useVirtualRows";
import "./VirtualList.css";

export type VirtualRow = { key: string; render: () => ReactNode };

export const VirtualList = ({
  rows,
  viewport,
  pinned = [],
}: {
  rows: readonly VirtualRow[];
  viewport: RefObject<HTMLDivElement | null>;
  pinned?: readonly number[];
}) => {
  const keys = useMemo(() => rows.map((row) => row.key), [rows]);
  const list = useRef<HTMLDivElement>(null);
  const virtual = useVirtualRows(keys, viewport, pinned, list);
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
