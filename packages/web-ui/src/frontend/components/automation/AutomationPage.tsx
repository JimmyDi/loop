import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schedule } from "../../../shared/schedules";
import { submitScheduleRun } from "../../hooks/useManualScheduleSessions";
import { useProjects } from "../../hooks/useProjects";
import { api, command } from "../../lib/api";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ScheduleRunHistory } from "./ScheduleRunHistory";
import { ScheduleForm } from "./ScheduleForm";
import type { ScheduleAction } from "./ScheduleRow";
import { ScheduleRow } from "./ScheduleRow";
import "./AutomationPage.css";

export const AutomationPage = () => {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { projects } = useProjects();
  const [edit, setEdit] = useState<Schedule | "new">();
  const [history, setHistory] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const plans = useQuery({
    queryKey: ["schedules"],
    queryFn: ({ signal }) => api<Schedule[]>("/schedules", { signal }),
    enabled: !history,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const change = useMutation({
    mutationFn: (req: { plan: Schedule } | { path: string; body?: unknown; method: string }) =>
      "plan" in req ? submitScheduleRun(client, req.plan) : command(req.path, req.body, req.method),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["schedules"] }),
        client.invalidateQueries({ queryKey: ["schedule-runs"] }),
      ]);
    },
  });
  const actOnPlan = (plan: Schedule, action: ScheduleAction) =>
    change.mutate(
      action === "run"
        ? { plan }
        : {
            path: "/schedules/" + plan.id + (action === "delete" ? "" : "/" + action),
            method: action === "delete" ? "DELETE" : "POST",
          },
      action === "delete" ? { onSuccess: () => setEdit(undefined) } : undefined,
    );
  const openEditor = (plan: Schedule | "new") => {
    change.reset();
    setHistory(false);
    setEdit(plan);
  };
  const savedPlan =
    edit && edit !== "new" ? (plans.data?.find((p) => p.id === edit.id) ?? edit) : undefined;
  if (edit)
    return (
      <main className="automation-page" aria-label="Automation">
        <ScheduleForm
          plan={savedPlan}
          onAction={savedPlan && ((action) => actOnPlan(savedPlan, action))}
          projects={projects.data ?? []}
          error={change.error ?? projects.error}
          busy={change.isPending}
          cancel={() => {
            change.reset();
            setEdit(undefined);
          }}
          save={(body) =>
            change.mutate(
              {
                path: edit === "new" ? "/schedules" : "/schedules/" + edit.id,
                method: edit === "new" ? "POST" : "PUT",
                body,
              },
              { onSuccess: () => setEdit(undefined) },
            )
          }
        />
      </main>
    );
  const add = (
    <ActionButton
      className="ghost automation-action automation-add"
      disabled={change.isPending}
      onClick={() => openEditor("new")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {t("scheduleAdd")}
    </ActionButton>
  );
  return (
    <main className="automation-page" aria-label="Automation">
      <header className="automation-toolbar">
        <button
          type="button"
          className="automation-back"
          aria-label={t("automationBack")}
          title={t("automationBack")}
          onClick={() => useWorkspace.getState().showAutomation(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12H4m7-7-7 7 7 7" />
          </svg>
        </button>
        <div className="automation-switch" role="group" aria-label="Automation">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              aria-pressed={history === value}
              onClick={() => setHistory(value)}
            >
              {t(value ? "scheduleHistory" : "scheduleTasks")}
            </button>
          ))}
        </div>
        {!!plans.data?.length && add}
      </header>
      <div className="automation-content" ref={viewport}>
        <ErrorNotice
          error={change.error ?? (history ? undefined : (plans.error ?? projects.error))}
        />
        {history ? (
          <ScheduleRunHistory viewport={viewport} />
        ) : plans.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : plans.data?.length === 0 ? (
          <div className="automation-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="m9 13 2 2 4-5M2 6l4-4m12 0 4 4M6 19l-2 3m14-3 2 3" />
            </svg>
            <p>{t("scheduleEmpty")}</p>
            {add}
          </div>
        ) : (
          <section>
            <h2 className="schedule-list-heading">{t("scheduleListHeading")}</h2>
            <ul className="automation-list">
              {plans.data?.map((plan) => (
                <ScheduleRow
                  key={plan.id}
                  plan={plan}
                  now={plans.dataUpdatedAt}
                  project={projects.data?.find((p) => p.id === plan.projectId)?.name}
                  busy={change.isPending}
                  edit={() => openEditor(plan)}
                  change={(action) => actOnPlan(plan, action)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
};
