import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import { useSessions } from "../../state/session-store";
import { useReadState } from "../../state/read-store";
import { latestCompletedTurn } from "../../../shared/completed-turn";
import { useProjectMenu } from "../../hooks/useProjectMenu";
import { useSessionActions } from "../../hooks/useSessionActions";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ActionButton } from "../ui/ActionButton";
import { SessionContextMenu } from "./SessionContextMenu";
import { SessionDeleteDialog } from "./SessionDeleteDialog";
import { SessionRenameInput } from "./SessionRenameInput";
import "./SessionItem.css";

export const SessionItem = ({ session }: { session: SessionSummary }) => {
  const { t } = useTranslation();
  const active = useWorkspace((state) => state.active?.id === session.id);
  const view = useSessions((state) => state.views[session.id]);
  const [point, setPoint] = useState<{ x: number; y: number }>();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const restoreFocus = useRef(false);
  const menu = useProjectMenu(point);
  const action = useSessionActions(session);
  const snapshot = view?.connected ? view.snapshot : undefined;
  const generating = snapshot ? snapshot.operation === "prompt" : session.isGenerating === true;
  const waiting = snapshot
    ? (snapshot.state.pendingApprovals?.some((request) => request.sessionId === session.id) ??
      false)
    : session.isWaitingForApproval === true;
  const readTurn = useReadState((state) => state.readTurns[session.id] ?? -1);
  const completedTurn = snapshot
    ? latestCompletedTurn(snapshot.state.runTimings, snapshot.state.messages.length)
    : session.latestCompletedTurn;
  const unread = !waiting && !generating && completedTurn !== undefined && completedTurn > readTurn;
  const busy =
    action.pending ||
    waiting ||
    generating ||
    !!(snapshot && (snapshot.operation !== "idle" || snapshot.state.hasPendingSave));
  const title = snapshot?.state.title?.text ?? session.title ?? t("newSession");
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      menu.trigger.current?.focus();
    }
  }, [editing, menu.trigger]);
  const choose = (next: "rename" | "archive" | "delete") => {
    menu.close();
    action.clearError();
    if (next === "rename") setEditing(true);
    else if (next === "delete") setDeleting(true);
    else void action.change("archive");
  };
  return (
    <li className="session-item">
      <div
        className="session-item-row"
        data-active={active}
        data-menu-open={menu.open}
        onContextMenu={(event) => {
          if (editing) return;
          event.preventDefault();
          menu.trigger.current?.focus();
          setPoint({ x: event.clientX, y: event.clientY });
          menu.setOpen(true);
        }}
      >
        {editing ? (
          <SessionRenameInput
            id={session.id}
            title={title}
            onClose={() => {
              restoreFocus.current = true;
              setEditing(false);
            }}
          />
        ) : (
          <>
            <button
              ref={menu.trigger}
              type="button"
              className="session-item-open"
              title={title}
              aria-current={active ? "page" : undefined}
              aria-haspopup="menu"
              aria-expanded={menu.open}
              onClick={() =>
                useWorkspace.getState().open({ id: session.id, workspaceId: session.workspaceId })
              }
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  event.preventDefault();
                  setPoint(undefined);
                  menu.setOpen(true);
                }
              }}
            >
              {waiting && (
                <span
                  className="session-list-waiting"
                  aria-hidden="true"
                  title={t("permissions.waiting")}
                />
              )}
              <span className="session-list-title">{title}</span>
              {waiting && (
                <span
                  className="session-list-pending"
                  role="img"
                  aria-label={t("permissions.waiting")}
                  title={t("permissions.waiting")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
              )}
              {generating && !waiting && (
                <span
                  className="session-list-spinner"
                  role="img"
                  aria-label={t("looping", "Looping...")}
                  title={t("looping", "Looping...")}
                />
              )}
              {unread && (
                <span
                  className="session-list-unread"
                  role="img"
                  aria-label={t("unread")}
                  title={t("unread")}
                />
              )}
            </button>
            <ActionButton
              className="session-item-archive icon ghost"
              aria-label={t("archiveChat", { name: title })}
              title={t("archiveSession")}
              disabled={busy}
              onClick={() => void action.change("archive")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M3 4h18v4H3zM9 12h6" />
              </svg>
            </ActionButton>
          </>
        )}
      </div>
      {!deleting && <ErrorNotice error={action.error} />}
      {menu.open && (
        <SessionContextMenu menu={menu} title={title} disabled={busy} onChoose={choose} />
      )}
      {deleting && (
        <SessionDeleteDialog
          pending={action.pending}
          error={action.error}
          onClose={() => {
            action.clearError();
            setDeleting(false);
          }}
          onConfirm={() => {
            void action.change("delete").then((saved) => {
              if (saved) setDeleting(false);
            });
          }}
        />
      )}
    </li>
  );
};
