import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { contextPercentage } from "../../lib/context-percentage";
import "./ComposerCommands.css";

export const ComposerCommands = ({
  snapshot,
  text,
  disabled,
  commandDisabled,
  onCompact,
}: {
  snapshot: SessionSnapshot;
  text: string;
  disabled: boolean;
  commandDisabled: boolean;
  onCompact(): void;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<string>();
  const query = text.match(/^\s*\/([a-z]*)\s*$/i)?.[1]?.toLowerCase();
  const visible = query !== undefined && text !== dismissed && !disabled;
  const matches = query !== undefined && "compact".startsWith(query);
  const percent = contextPercentage(snapshot);
  const ringPercent = Math.min(100, Math.max(0, percent ?? 0));
  useEffect(() => {
    setDismissed(undefined);
  }, [text, snapshot.sessionId]);

  const choose = () => {
    if (commandDisabled) return;
    onCompact();
    root.current
      ?.closest("form")
      ?.querySelector<HTMLElement>('[role="textbox"]')
      ?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!visible) return;
    const form = root.current?.closest("form");
    const input = form?.querySelector('[role="textbox"]');
    input?.setAttribute("aria-controls", id);
    input?.setAttribute("aria-expanded", "true");
    if (matches) input?.setAttribute("aria-activedescendant", id + "-compact");
    const handle = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.target !== input && !root.current?.contains(event.target as Node)) return;
      if (!["Escape", "Enter", "Tab", "ArrowDown", "ArrowUp"].includes(event.key)) return;
      if (event.key === "Tab" && (!matches || commandDisabled)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") setDismissed(text);
      else if ((event.key === "Enter" || event.key === "Tab") && matches) choose();
    };
    const dismiss = (event: PointerEvent) => {
      if (!form?.contains(event.target as Node)) setDismissed(text);
    };
    form?.addEventListener("keydown", handle, true);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      form?.removeEventListener("keydown", handle, true);
      document.removeEventListener("pointerdown", dismiss);
      for (const attribute of ["aria-controls", "aria-expanded", "aria-activedescendant"])
        input?.removeAttribute(attribute);
    };
  });
  return (
    <div className="composer-commands" ref={root}>
      {visible && (
        <div
          id={id}
          role="listbox"
          aria-label={t("compaction.commands")}
          className="composer-command-menu"
        >
          {matches ? (
            <button
              id={id + "-compact"}
              type="button"
              role="option"
              aria-selected="true"
              aria-disabled={commandDisabled}
              title={
                snapshot.state.compactionAvailable === false
                  ? t("errors.nothing_to_compact")
                  : undefined
              }
              onClick={choose}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" opacity=".35" />
                {ringPercent > 0 && (
                  <circle
                    className="composer-command-ring-fill"
                    cx="12"
                    cy="12"
                    r="9"
                    pathLength="100"
                    strokeDasharray={`${ringPercent} 100`}
                    strokeLinecap="butt"
                    transform="rotate(-90 12 12)"
                  />
                )}
              </svg>
              <strong>{t("compaction.command")}</strong>
              <span>
                {t("compaction.description")}
                {percent !== undefined && " " + t("compaction.percentage", { percent })}
              </span>
            </button>
          ) : (
            <p>{t("compaction.noMatch")}</p>
          )}
        </div>
      )}
    </div>
  );
};
