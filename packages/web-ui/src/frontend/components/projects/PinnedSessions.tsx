import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { Project, SessionSummary } from "../../../shared/protocol";
import { projectSessionsQueryOptions } from "../../hooks/useProjectSessions";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SidebarSessionSection } from "./SidebarSessionSection";
import "./PinnedSessions.css";
import "./SessionList.css";

export const PinnedSessions = ({ projects }: { projects: Project[] }) => {
  const { t } = useTranslation();
  const queries = useQueries({
    queries: [
      projectSessionsQueryOptions(null),
      ...projects
        .filter((project) => project.accessible !== false)
        .map((project) => projectSessionsQueryOptions(project.id)),
    ],
  });
  const sessions: SessionSummary[] = queries
    .flatMap((query, index) =>
      (query.data ?? []).filter(
        (session) =>
          session.workspaceId ===
          (index === 0
            ? null
            : projects.filter((project) => project.accessible !== false)[index - 1]?.id),
      ),
    )
    .filter((session) => session.pinnedAt && !session.archived && session.userMessageCount > 0)
    .sort((a, b) => b.pinnedAt!.localeCompare(a.pinnedAt!) || b.id.localeCompare(a.id));
  const error = queries.find((query) => query.error)?.error;

  if (!sessions.length) return <ErrorNotice error={error} />;

  return (
    <SidebarSessionSection title={t("pinnedSessions")} kind="pinned" sessions={sessions}>
      <ErrorNotice error={error} />
    </SidebarSessionSection>
  );
};
