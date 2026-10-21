import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./RemoteAccessInfo.css";

export const RemoteAccessInfo = () => {
  const { t } = useTranslation();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const contains = (node: Node | null) =>
    !!node && (trigger.current?.contains(node) || tooltip.current?.contains(node));
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!contains(document.activeElement)) setOpen(false);
    }, 150);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = tooltip.current.getBoundingClientRect();
    const fitsRight = anchor.right + 8 + bounds.width <= window.innerWidth - 12;
    setPosition({
      left: fitsRight
        ? anchor.right + 8
        : Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)),
      top: Math.max(
        12,
        fitsRight
          ? Math.min(
              anchor.top + (anchor.height - bounds.height) / 2,
              window.innerHeight - bounds.height - 12,
            )
          : anchor.top - bounds.height - 8,
      ),
    });
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.type === "keydown") {
        if ((event as KeyboardEvent).key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (tooltip.current?.contains(document.activeElement)) trigger.current?.focus();
      }
      if (event.type === "pointerdown" && contains(event.target as Node)) return;
      if (event.type === "scroll" && tooltip.current?.contains(event.target as Node)) return;
      clearTimeout(timer.current);
      setOpen(false);
    };
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  return (
    <>
      <ActionButton
        ref={trigger}
        className="icon ghost"
        aria-label={t("remote.info")}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        onKeyDown={(event) => {
          if (open && event.key === "Tab" && !event.shiftKey) {
            event.preventDefault();
            tooltip.current?.querySelector("a")?.focus();
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5v6M12 7v1" />
        </svg>
      </ActionButton>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            className="remote-access-info-tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onKeyDown={(event) => {
              if (
                event.key === "Tab" &&
                event.shiftKey &&
                event.target === tooltip.current?.querySelector("a")
              ) {
                event.preventDefault();
                trigger.current?.focus();
              }
            }}
          >
            {t("remote.termsPrefix")}{" "}
            <a href="https://aka.ms/devtunnels/tos" target="_blank" rel="noreferrer">
              {t("remote.terms")}
            </a>
            {" · "}
            <a
              href="https://privacy.microsoft.com/privacystatement"
              target="_blank"
              rel="noreferrer"
            >
              {t("remote.privacy")}
            </a>
          </div>,
          trigger.current?.closest("dialog") ?? document.body,
        )}
    </>
  );
};
