import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import type { CSSProperties } from "react";
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
import { SessionStatus } from "./SessionStatus";
import { PlanPanelContext } from "../../lib/plan-panel-context";
import { usePanelTabs } from "../../hooks/usePanelTabs";
import { PlanIcon } from "./PlanIcon";
import { WorkspacePanel, PanelResizer, PanelTabs } from "../../lib/lazy-panel-components";
import {
  SessionApprovals,
  UserInputCard,
  PlanReviewCard,
} from "../../lib/lazy-session-interactions";
import { ChatComposer } from "../../lib/lazy-composer";
import { PlanContentPanel } from "../../lib/lazy-plan-content";
import "./ChatWorkspace.css";

export const ChatWorkspace = ({ id }: { id?: string }) => {
  const { t } = useTranslation();
  const [panelRatio, setPanelRatio] = useState(0.5);
  const [resizing, setResizing] = useState(false);
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
  const panel = usePanelTabs<{ kind: "plan"; planId: string }>(snapshot?.sessionId ?? id ?? "new");
  const empty =
    snapshot &&
    snapshot.state.messages.length === 0 &&
    !snapshot.state.draft &&
    snapshot.operation !== "prompt";

  return (
    <PlanPanelContext
      value={(id) => {
        const plan = snapshot?.state.planning?.plans.find((plan) => plan.id === id);
        if (plan)
          panel.add({
            id,
            title: "Plan",
            content: { kind: "plan", planId: id },
          });
      }}
    >
      <div
        className="chat-panel-workspace"
        data-panel={panel.open}
        data-resizing={resizing}
        style={{ "--panel-ratio": panelRatio * 100 + "%" } as CSSProperties}
      >
        <SessionHeader
          snapshot={snapshot}
          panel={panel.open || panel.tabs.length ? panel : undefined}
          tabs={
            !!panel.tabs.length && (
              <Suspense fallback={null}>
                <PanelTabs
                  tabs={panel.tabs}
                  active={panel.active}
                  select={panel.select}
                  close={panel.close}
                  renderIcon={() => <PlanIcon />}
                />
              </Suspense>
            )
          }
        />
        <div className="chat-plan-layout" data-panel={panel.open} data-resizing={resizing}>
          {panel.open && (
            <Suspense fallback={null}>
              <PanelResizer ratio={panelRatio} change={setPanelRatio} dragging={setResizing} />
            </Suspense>
          )}
          <main className="chat-workspace">
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
                  {!!snapshot.state.pendingApprovals?.length && (
                    <Suspense fallback={null}>
                      <SessionApprovals snapshot={snapshot} connected={connected} />
                    </Suspense>
                  )}
                  {snapshot.state.pendingUserInputs?.[0] && (
                    <Suspense fallback={null}>
                      <UserInputCard
                        key={snapshot.state.pendingUserInputs[0].requestId}
                        request={snapshot.state.pendingUserInputs[0]}
                        connected={connected}
                      />
                    </Suspense>
                  )}
                  {snapshot.state.planning?.plans.at(-1)?.status === "ready" && (
                    <Suspense fallback={null}>
                      <PlanReviewCard
                        key={snapshot.sessionId + snapshot.state.planning.plans.at(-1)!.id}
                        snapshot={snapshot}
                        connected={connected}
                      />
                    </Suspense>
                  )}
                  <Suspense fallback={null}>
                    <ChatComposer
                      key={snapshot.sessionId}
                      snapshot={snapshot}
                      connected={connected}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </main>
          <div className="workspace-panel-slot" inert={!panel.open} aria-hidden={!panel.open}>
            {!!panel.tabs.length && (
              <Suspense fallback={null}>
                <WorkspacePanel
                  tabs={panel.tabs}
                  active={panel.active}
                  renderContent={(content) => {
                    const plan = snapshot?.state.planning?.plans.find(
                      (plan) => plan.id === content.planId,
                    );
                    return plan ? <PlanContentPanel plan={plan} /> : null;
                  }}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </PlanPanelContext>
  );
};
