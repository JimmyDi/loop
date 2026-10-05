import { useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { ArchivedChat } from "../../hooks/useArchivedChats";
import { useProjectMenu } from "../../hooks/useProjectMenu";
import { ActionButton } from "../ui/ActionButton";
import "./ArchivedChatGroup.css";

export const ArchivedChatGroup = ({
  name,
  sessions,
  pending,
  onOpen,
  onRestore,
  onDelete,
  onDeleteProject,
}: {
  name: string;
  sessions: ArchivedChat[];
  pending: boolean;
  onOpen(session: ArchivedChat): void;
  onRestore(session: ArchivedChat): void;
  onDelete(sessions: ArchivedChat[]): void;
  onDeleteProject(): void;
}) => {
  const { t, i18n } = useTranslation();
  const id = useId();
  const menu = useProjectMenu();
  const date = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <section className="archived-chat-group" aria-labelledby={id}>
      <header className="archived-project-heading">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 9h18M3 19V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
        <h4 id={id}>{name}</h4>
        <span>{t("archivedChatCount", { count: sessions.length })}</span>
        <ActionButton
          className="archived-project-menu-trigger ghost"
          ref={menu.trigger}
          aria-label={t("projectOptions", { name })}
          aria-haspopup="menu"
          aria-expanded={menu.open}
          disabled={pending}
          onClick={() => (menu.open ? menu.close() : menu.setOpen(true))}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </ActionButton>
        {menu.open &&
          createPortal(
            <div
              className="archived-project-menu"
              ref={menu.panel}
              role="menu"
              aria-label={t("projectOptions", { name })}
              style={menu.position}
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
                  menu.close();
                  onDeleteProject();
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />
                </svg>
                {t("deleteAllInProject")}
              </button>
            </div>,
            menu.trigger.current?.closest("dialog") ?? document.body,
          )}
      </header>
      <ul className="archived-chat-card">
        {sessions.map((session) => {
          const timestamp = Date.parse(session.updatedAt);
          return (
            <li key={session.id}>
              <button
                type="button"
                className="archived-chat-open"
                disabled={pending}
                onClick={() => onOpen(session)}
              >
                <span>{session.title ?? t("newSession")}</span>
                {Number.isFinite(timestamp) && (
                  <time dateTime={session.updatedAt}>{date.format(timestamp)}</time>
                )}
              </button>
              <ActionButton
                className="archived-chat-delete ghost"
                aria-label={t("deleteChat", { name: session.title ?? t("newSession") })}
                title={t("deleteChat", { name: session.title ?? t("newSession") })}
                disabled={pending}
                onClick={() => onDelete([session])}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />
                </svg>
              </ActionButton>
              <ActionButton
                className="archived-chat-restore ghost"
                aria-label={t("restoreChat", { name: session.title ?? t("newSession") })}
                disabled={pending}
                onClick={() => onRestore(session)}
              >
                {t("unarchive")}
              </ActionButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
