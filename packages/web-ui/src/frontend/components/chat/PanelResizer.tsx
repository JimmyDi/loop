import { useRef } from "react";
import { useTranslation } from "react-i18next";

import "./PanelResizer.css";

export const PanelResizer = ({
  ratio,
  change,
  dragging,
}: {
  ratio: number;
  change(value: number): void;
  dragging(active: boolean): void;
}) => {
  const { t } = useTranslation();
  const pointer = useRef<number | undefined>(undefined);
  const resize = (clientX: number, element: HTMLElement) => {
    const bounds = element.closest(".chat-plan-layout")?.getBoundingClientRect();
    if (!bounds?.width) return;
    const min = Math.min(280, bounds.width * 0.4);
    const max = bounds.width - Math.min(320, bounds.width * 0.45);
    const width = Math.min(max, Math.max(min, bounds.right - clientX));
    change(width / bounds.width);
  };
  const finish = () => {
    pointer.current = undefined;
    dragging(false);
  };
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t("resizePanel")}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging(true);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) resize(event.clientX, event.currentTarget);
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        finish();
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const bounds = event.currentTarget.closest(".chat-plan-layout")?.getBoundingClientRect();
        if (bounds?.width)
          resize(
            bounds.right - bounds.width * ratio + (event.key === "ArrowLeft" ? -16 : 16),
            event.currentTarget,
          );
      }}
    />
  );
};
