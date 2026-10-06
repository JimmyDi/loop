import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./McpAddMenu.css";

export const McpAddMenu = ({ onAdd, disabled = false }: { onAdd(): void; disabled?: boolean }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      className="mcp-add-menu"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
          return;
        }
        if (event.key === "Tab" && open) {
          // Resume native tab order from the trigger before removing the focused item.
          trigger.current?.focus();
          setOpen(false);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        }
      }}
    >
      <ActionButton
        className="mcp-add-trigger"
        ref={trigger}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <span>{t("mcp.add")}</span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            d="m4 7 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ActionButton>
      {open && (
        <div className="mcp-add-options" role="menu" id={id}>
          <ActionButton
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            {t("mcp.addServer")}
          </ActionButton>
        </div>
      )}
    </div>
  );
};
