import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./PluginAddMenu.css";

type PluginAddAction = "mcp" | "created" | "github" | "local";

const items = [
  {
    action: "mcp",
    label: "mcp.addServer",
    path: "m8 12 5-5a3 3 0 0 1 4 4l-7 7a5 5 0 0 1-7-7l7-7a7 7 0 0 1 10 10l-7 7",
  },
  {
    action: "created",
    label: "skills.created",
    path: "M14 3H5v18h14v-9M14 3v6h5M14 3l5 6M8 14h6M11 11v6",
  },
  { action: "github", label: "skills.github", path: "M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" },
  { action: "local", label: "skills.local", path: "M3 7V5h6l2 2h10v13H3V7Z" },
] as const;

export const PluginAddMenu = ({
  onSelect,
  disabled = false,
  section,
}: {
  onSelect(action: PluginAddAction): void;
  disabled?: boolean;
  section: "mcps" | "skills";
}) => {
  const { t } = useTranslation();
  const menuItems = items.filter((item) => (item.action === "mcp") === (section === "mcps"));
  const [open, setOpen] = useState(false);
  const [firstItem, setFirstItem] = useState(0);
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
      className="plugin-add-menu"
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
          if (disabled) return;
          event.preventDefault();
          setOpen(true);
          if (!open) {
            setFirstItem(event.key === "ArrowDown" ? 0 : menuItems.length - 1);
            return;
          }
          const options = Array.from(
            root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
          );
          const current = options.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === "ArrowDown"
              ? current + 1
              : current < 0
                ? options.length - 1
                : current - 1;
          options[(next + options.length) % options.length]?.focus();
        }
      }}
    >
      <ActionButton
        className="plugin-add-trigger"
        ref={trigger}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        onClick={() => {
          setOpen(!open);
          setFirstItem(0);
        }}
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
        <div className="plugin-add-options" role="menu" aria-label={t("mcp.add")} id={id}>
          {menuItems.map((item, index) => (
            <ActionButton
              key={item.action}
              role="menuitem"
              autoFocus={index === firstItem}
              onClick={() => {
                setOpen(false);
                onSelect(item.action);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={item.path} />
              </svg>
              <span>{t(item.label)}</span>
            </ActionButton>
          ))}
        </div>
      )}
    </div>
  );
};
