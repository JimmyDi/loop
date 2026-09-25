import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useSessionEvents } from "../../hooks/useSessionEvents";
import { api } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { SessionHeader } from "../layout/SessionHeader";
import { SessionTabs } from "../layout/SessionTabs";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MessageTimeline } from "./MessageTimeline";
import { ChatComposer } from "./ChatComposer";
import { SessionStatus } from "./SessionStatus";
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

  return (
    <main className="chat-workspace">
      <SessionHeader snapshot={snapshot} connected={connected} />
      <SessionTabs />
      {query.error && (
        <div className="workspace-error">
          <ErrorNotice error={query.error} />
          <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
        </div>
      )}
      {!snapshot && !query.error && <p className="workspace-loading">{t("loading")}</p>}
      {snapshot && (
        <>
          <MessageTimeline snapshot={snapshot} />
          <SessionStatus snapshot={snapshot} connected={connected} />
          <ChatComposer snapshot={snapshot} connected={connected} />
        </>
      )}
    </main>
  );
};
