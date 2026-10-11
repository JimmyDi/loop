import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useProjectMenu } from "../../hooks/useProjectMenu";
import { ActionButton } from "../ui/ActionButton";
import "./MessageQueueActions.css";

export const MessageQueueActions = ({
  disabled,
  editing,
  steering,
  held = false,
  editDisabled = false,
  onEdit,
  onSteer,
  onDelete,
}: {
  disabled: boolean;
  editing: boolean;
  steering: boolean;
  held?: boolean;
  editDisabled?: boolean;
  onEdit(): void;
  onSteer(): void;
  onDelete(): void;
}) => {
  const { t } = useTranslation();
  const menu = useProjectMenu();
  const id = useId();
  const blocked = disabled || editing;

  useEffect(() => {
    if (blocked || editDisabled) menu.setOpen(false);
  }, [blocked, editDisabled, menu.setOpen]);

  return (
    <div className="queue-actions">
      <ActionButton
        className="queue-steer ghost"
        disabled={blocked || held}
        title={t(steering ? "queueSteering" : "queueSteer")}
        onClick={onSteer}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5v6a3 3 0 0 0 3 3h13m-5-5 5 5-5 5" />
        </svg>
        {t(steering ? "queueSteering" : "queueSteer")}
      </ActionButton>
      <ActionButton
        className="queue-delete icon ghost"
        disabled={disabled}
        aria-label={t("queueDelete")}
        title={t("queueDelete")}
        onClick={onDelete}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />
        </svg>
      </ActionButton>
      <ActionButton
        ref={menu.trigger}
        className="queue-more icon ghost"
        disabled={blocked || editDisabled}
        aria-label={t("queueMore")}
        title={t("queueMore")}
        aria-haspopup="menu"
        aria-expanded={menu.open && !blocked && !editDisabled}
        aria-controls={menu.open && !blocked && !editDisabled ? id : undefined}
        onClick={() => (menu.open ? menu.close() : menu.setOpen(true))}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            menu.setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </ActionButton>
      {menu.open &&
        !blocked &&
        !editDisabled &&
        createPortal(
          <div
            id={id}
            ref={menu.panel}
            className="queue-options-menu"
            style={menu.position}
            role="menu"
            aria-label={t("queueMore")}
            onKeyDown={menu.navigate}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
                menu.close(false);
            }}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                menu.close(false);
                onEdit();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 3a2.1 2.1 0 0 1 3 3L8 17l-5 1 1-5L16 3Zm-2 2 3 3" />
              </svg>
              {t("queueEdit")}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};
