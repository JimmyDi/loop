import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { useProjectMenu } from "../../hooks/useProjectMenu";
import "./SessionContextMenu.css";

export const SessionContextMenu = ({
  menu,
  title,
  disabled,
  onChoose,
}: {
  menu: ReturnType<typeof useProjectMenu>;
  title: string;
  disabled: boolean;
  onChoose(action: "rename" | "archive" | "delete"): void;
}) => {
  const { t } = useTranslation();
  return createPortal(
    <div
      ref={menu.panel}
      className="session-context-menu"
      style={menu.position}
      role="menu"
      tabIndex={-1}
      aria-label={t("sessionOptions", { name: title })}
      onKeyDown={menu.navigate}
      onContextMenu={(event) => event.preventDefault()}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          menu.close(false);
      }}
    >
      {(
        [
          ["rename", "rename", "M16 3a2.1 2.1 0 0 1 3 3L8 17l-5 1 1-5L16 3Zm-2 2 3 3"],
          [
            "archive",
            "archiveSession",
            "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M3 4h18v4H3zM9 12h6",
          ],
          ["delete", "permanentlyDelete", "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"],
        ] as const
      ).map(([action, label, path]) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => onChoose(action)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={path} />
          </svg>
          {t(label)}
        </button>
      ))}
    </div>,
    document.body,
  );
};
