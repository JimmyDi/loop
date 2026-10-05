import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { Project, SessionSummary } from "../../../shared/protocol";
import { api } from "../../lib/api";
import { useProjects } from "../../hooks/useProjects";
import { useProjectArchive } from "../../hooks/useProjectArchive";
import { useProjectMenu } from "../../hooks/useProjectMenu";
import { useWorkspace } from "../../state/workspace-store";
import { useRequests } from "../../state/request-store";
import { ActionButton } from "../ui/ActionButton";
import { ProjectConfirmation } from "./ProjectConfirmation";
import "./ProjectActions.css";

export const ProjectActions = ({
  project,
  contextPoint,
}: {
  project: Project;
  contextPoint?: { x: number; y: number };
}) => {
  const { t } = useTranslation();
  const { remove } = useProjects();
  const archive = useProjectArchive(project.id);
  const [point, setPoint] = useState<{ x: number; y: number }>();
  const menu = useProjectMenu(point);
  const { setOpen } = menu;
  useEffect(() => {
    if (!contextPoint) return;
    setPoint(contextPoint);
    setOpen(true);
  }, [contextPoint, setOpen]);
  const id = useId();
  const [action, setAction] = useState<"archive" | "remove">();
  const [selection, setSelection] = useState<{ ids: string[]; error?: unknown }>();
  useEffect(() => {
    if (action !== "archive") return;
    let cancelled = false;
    void api<SessionSummary[]>("/sessions?workspaceId=" + project.id).then(
      (sessions) => {
        if (!cancelled) setSelection({ ids: sessions.map((session) => session.id) });
      },
      (error: unknown) => {
        if (!cancelled) setSelection({ ids: [], error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [action, project.id]);
  const workspace = useWorkspace();
  const drafts = Object.keys(workspace.draftProjects).some(
    (id) =>
      workspace.draftProjects[id] === project.id &&
      (workspace.drafts[id]?.trim() ||
        workspace.images[id]?.length ||
        workspace.files[id]?.length ||
        useRequests.getState().pending[id]),
  );
  const pending = remove.isPending || archive.isPending;
  const choose = (next: "archive" | "remove") => {
    menu.close();
    remove.reset();
    archive.reset();
    setSelection(undefined);
    setAction(next);
  };
  const confirm = async () => {
    try {
      if (action === "archive") {
        if (!selection || selection.error) return;
        await archive.mutateAsync({ ids: selection.ids, archived: true });
      } else {
        await remove.mutateAsync(project.id);
        const state = useWorkspace.getState();
        if (state.active?.workspaceId === project.id) useRequests.getState().put(state.active.id);
        for (const [id, owner] of Object.entries(state.draftProjects)) {
          if (owner === project.id) useRequests.getState().put(id);
        }
        state.removeProject(project.id);
      }
      setAction(undefined);
    } catch {
      // The confirmation remains open and displays the mutation error.
    }
  };

  return (
    <div className="project-actions" data-open={menu.open || !!action}>
      <ActionButton
        ref={menu.trigger}
        className="project-icon-button icon ghost"
        aria-label={t("projectOptions", { name: project.name })}
        title={t("projectOptions", { name: project.name })}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        onClick={() => {
          setPoint(undefined);
          if (menu.open) menu.close();
          else menu.setOpen(true);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setPoint(undefined);
            menu.setOpen(true);
          }
        }}
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
            id={id}
            ref={menu.panel}
            className="project-menu"
            style={menu.position}
            role="menu"
            aria-label={t("projectOptions", { name: project.name })}
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
              disabled={project.accessible === false}
              onClick={() => choose("archive")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8v12h16V8M3 4h18v4H3zM9 12h6" />
              </svg>
              {t("archiveChats")}
            </button>
            <hr />
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => choose("remove")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 14V7H11L9 4H4a2 2 0 0 0-2 2v13a1 1 0 0 0 1 1h10M16 17l6 6m0-6-6 6" />
              </svg>
              {t("removeProject")}
            </button>
          </div>,
          document.body,
        )}
      {action && (
        <ProjectConfirmation
          action={action}
          name={project.name}
          count={selection?.ids.length ?? 0}
          pending={pending}
          loading={action === "archive" && !selection}
          drafts={drafts}
          error={selection?.error ?? archive.error ?? remove.error}
          onClose={() => setAction(undefined)}
          onConfirm={() => void confirm()}
        />
      )}
    </div>
  );
};
