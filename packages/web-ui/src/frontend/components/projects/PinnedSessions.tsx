import { useId } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { Project, SessionSummary } from "../../../shared/protocol";
import { projectSessionsQueryOptions } from "../../hooks/useProjectSessions";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SessionItem } from "./SessionItem";
import "./PinnedSessions.css";
import "./SessionList.css";

export const PinnedSessions = ({ projects }: { projects: Project[] }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const queries = useQueries({
    queries: projects
      .filter((project) => project.accessible !== false)
      .map((project) => projectSessionsQueryOptions(project.id)),
  });
  const sessions: SessionSummary[] = queries
    .flatMap((query) => query.data ?? [])
    .filter((session) => session.pinnedAt && !session.archived && session.userMessageCount > 0)
    .sort((a, b) => b.pinnedAt!.localeCompare(a.pinnedAt!) || b.id.localeCompare(a.id));
  const error = queries.find((query) => query.error)?.error;

  if (!sessions.length) return <ErrorNotice error={error} />;

  return (
    <section className="pinned-sessions" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("pinnedSessions")}</h2>
      <ul className="session-list">
        {sessions.map((session) => (
          <SessionItem key={session.id} session={session} />
        ))}
      </ul>
      <ErrorNotice error={error} />
    </section>
  );
};
