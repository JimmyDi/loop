import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchivedChats } from "../../hooks/useArchivedChats";
import type { ArchivedChat } from "../../hooks/useArchivedChats";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ArchivedChatGroup } from "./ArchivedChatGroup";
import { ArchiveDeleteDialog } from "./ArchiveDeleteDialog";
import "./ArchivedChats.css";

export const ArchivedChats = ({ onOpen }: { onOpen?(): void }) => {
  const { t } = useTranslation();
  const { sessions, change } = useArchivedChats();
  const [project, setProject] = useState("");
  const [kind, setKind] = useState("all");
  const [selection, setSelection] = useState<ArchivedChat[]>();
  const all = sessions.data ?? [];
  const projects = [
    ...new Map(all.map((session) => [session.workspaceId, session.projectName])).entries(),
  ];
  const currentProject = projects.some(([id]) => id === project) ? project : "";
  const filtered = all.filter(
    (session) =>
      (!currentProject || session.workspaceId === currentProject) &&
      (kind === "all" ||
        (kind === "empty" ? session.messageCount === 0 : session.messageCount > 0)),
  );
  const selected = selection?.filter((session) => all.some((item) => item.id === session.id)) ?? [];
  const chooseDelete = (items: ArchivedChat[]) => {
    change.reset();
    setSelection(items);
  };
  return (
    <div className="archived-chats">
      <header className="archived-chats-header">
        <h3>{t("archivedChats")}</h3>
        <ActionButton
          className="archive-danger"
          disabled={change.isPending || sessions.isPending || !!sessions.error || !all.length}
          onClick={() => chooseDelete(all)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />
          </svg>
          {t("deleteAll")}
        </ActionButton>
      </header>
      <div className="archived-chats-filters">
        <select
          aria-label={t("chatFilter")}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">{t("allChats")}</option>
          <option value="messages">{t("chatsWithMessages")}</option>
          <option value="empty">{t("emptyChats")}</option>
        </select>
        <select
          aria-label={t("projectFilter")}
          value={currentProject}
          onChange={(event) => setProject(event.target.value)}
        >
          <option value="">{t("allProjects")}</option>
          {projects.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {sessions.isPending && <p role="status">{t("loading")}</p>}
      <ErrorNotice error={sessions.error ?? (!selection ? change.error : undefined)} />
      {sessions.error && (
        <ActionButton onClick={() => void sessions.refetch()}>{t("retry")}</ActionButton>
      )}
      {!sessions.isPending && !sessions.error && !filtered.length && <p>{t("noArchivedChats")}</p>}
      {projects.map(([id, name]) => {
        const items = filtered.filter((session) => session.workspaceId === id);
        return items.length ? (
          <ArchivedChatGroup
            key={id}
            name={name}
            sessions={items}
            pending={change.isPending}
            onOpen={(session) => {
              useWorkspace.getState().open({ id: session.id, workspaceId: session.workspaceId });
              onOpen?.();
            }}
            onRestore={(session) => change.mutate({ selected: [session], action: "restore" })}
            onDelete={chooseDelete}
            onDeleteProject={() =>
              chooseDelete(all.filter((session) => session.workspaceId === id))
            }
          />
        ) : null;
      })}
      {selection && (
        <ArchiveDeleteDialog
          count={selected.length}
          pending={change.isPending}
          error={change.error}
          onClose={() => setSelection(undefined)}
          onConfirm={() =>
            change.mutate(
              { selected, action: "delete" },
              { onSuccess: () => setSelection(undefined) },
            )
          }
        />
      )}
    </div>
  );
};
