import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceResourceInfoProps } from "./voice-resource-info-types";
import { VoiceResourceList } from "./VoiceResourceList";
import "./VoiceResourceInfo.css";

export const VoiceResourceInfo = ({ component, statusText, error }: VoiceResourceInfoProps) => {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = panel.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)),
      top: Math.max(12, Math.min(anchor.bottom, window.innerHeight - bounds.height - 12)),
    });
  }, [open, statusText, error]);
  return (
    <div
      className="voice-resource-info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!panel.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <ActionButton
        ref={trigger}
        className="icon ghost"
        aria-label={component.name + ": " + t("voice.resourceDetails")}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(true)}
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
            ref={panel}
            id={id}
            role="tooltip"
            className="voice-resource-info-panel"
            style={position}
            onMouseLeave={() => setOpen(false)}
          >
            <VoiceResourceList components={[component]} statusText={statusText} />
            {error && <span className="voice-resource-info-error">{error}</span>}
          </div>,
          trigger.current?.closest("dialog") ?? document.body,
        )}
    </div>
  );
};
