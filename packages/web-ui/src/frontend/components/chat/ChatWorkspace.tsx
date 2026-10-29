import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useSessionEvents } from "../../hooks/useSessionEvents";
import { api, ApiError, command } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import { SessionHeader } from "../layout/SessionHeader";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { LoopIcon } from "../ui/LoopIcon";
import { MessageTimeline } from "./MessageTimeline";
import { ChatComposer } from "./ChatComposer";
import { SessionStatus } from "./SessionStatus";
import { SessionApprovals } from "./SessionApprovals";
import "./ChatWorkspace.css";

export const ChatWorkspace = ({ id }: { id?: string }) => {
  const { t } = useTranslation();
  const client = useQueryClient();
  const view = useSessions((state) => (id ? state.views[id] : undefined));
  const query = useQuery({
    queryKey: ["session", id ?? "new"],
    queryFn: () =>
      id
        ? api<SessionSnapshot>("/sessions/" + id)
        : command<SessionSnapshot>("/sessions", { workspaceId: null }),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useSessionEvents(query.isSuccess ? (id ?? query.data.sessionId) : undefined);
  useEffect(() => {
    if (id || !query.data || useWorkspace.getState().active) return;
    client.setQueryData(["session", query.data.sessionId], query.data);
    useWorkspace.getState().open({ id: query.data.sessionId, workspaceId: query.data.workspaceId });
  }, [id, query.data, client]);
  useEffect(() => {
    if (id) client.removeQueries({ queryKey: ["session", "new"], exact: true });
  }, [id, client]);
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      query.error.status === 404 &&
      query.error.code === "session_not_found"
    ) {
      useWorkspace.setState((state) => (state.active?.id === id ? { active: undefined } : state));
    }
  }, [id, query.error]);

  const snapshot = view?.snapshot ?? query.data;
  const connected = view?.connected ?? false;
  const empty =
    snapshot &&
    snapshot.state.messages.length === 0 &&
    !snapshot.state.draft &&
    snapshot.operation !== "prompt";

  return (
    <main className="chat-workspace">
      <SessionHeader snapshot={snapshot} />
      {query.error && (
        <div className="workspace-error">
          <ErrorNotice error={query.error} />
          <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
        </div>
      )}
      {!snapshot && !query.error && <p className="workspace-loading">{t("loading")}</p>}
      {snapshot && (
        <div className="chat-workspace-body" data-empty={empty}>
          {empty ? (
            <div className="chat-welcome">
              <LoopIcon size={64} />
              <h1>Loop everything</h1>
            </div>
          ) : (
            <MessageTimeline snapshot={snapshot} connected={connected} />
          )}
          <div className="chat-workspace-input">
            <SessionStatus snapshot={snapshot} connected={connected} />
            <SessionApprovals snapshot={snapshot} connected={connected} />
            <ChatComposer key={snapshot.sessionId} snapshot={snapshot} connected={connected} />
          </div>
        </div>
      )}
    </main>
  );
};
