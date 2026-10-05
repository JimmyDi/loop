import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useSessionEvents } from "../../hooks/useSessionEvents";
import { api } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { SessionHeader } from "../layout/SessionHeader";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { LoopIcon } from "../ui/LoopIcon";
import { MessageTimeline } from "./MessageTimeline";
import { ChatComposer } from "./ChatComposer";
import { SessionStatus } from "./SessionStatus";
import { SessionApprovals } from "./SessionApprovals";
import "./ChatWorkspace.css";

export const ChatWorkspace = ({ id }: { id: string }) => {
  const { t } = useTranslation();
  const view = useSessions((state) => state.views[id]);
  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => api<SessionSnapshot>("/sessions/" + id),
    retry: false,
  });

  useSessionEvents(query.isSuccess ? id : undefined);

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
            <ChatComposer snapshot={snapshot} connected={connected} />
          </div>
        </div>
      )}
    </main>
  );
};
