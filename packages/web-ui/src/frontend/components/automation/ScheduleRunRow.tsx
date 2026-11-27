import { useTranslation } from "react-i18next";
import type { ScheduleRunPage } from "../../../shared/schedules";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import "./ScheduleRunRow.css";

type RunRow = ScheduleRunPage["runs"][number];

const statusPaths = {
  queued: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  completed: "m5 12 4 4L19 6",
  failed: "m6 6 12 12M18 6 6 18",
  interrupted: "M9 5v14m6-14v14",
  skipped: "m5 6 9 6-9 6V6Zm13 0v12",
  cancelled: "M8 12h8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "save-pending": "M12 5v8m0 5h.01",
};

export const ScheduleRunRow = ({
  run,
  busy,
  archive,
  remove,
  dayFormat,
  clock,
}: {
  run: RunRow;
  busy: boolean;
  archive(): void;
  remove(): void;
  dayFormat: Intl.DateTimeFormat;
  clock: Intl.DateTimeFormat;
}) => {
  const { t } = useTranslation();
  const running = run.status === "queued" || run.status === "running";
  const statusLabel = t("scheduleStatus_" + run.status);
  const time = new Date(run.scheduledFor);
  const contents = (
    <>
      <strong>{run.input.name}</strong>
      {run.error && (
        <span className="automation-run-error" title={run.error}>
          {run.error}
        </span>
      )}
      <span className="automation-run-meta">
        <time dateTime={time.toISOString()}>
          {run.archived && dayFormat.format(time) + " "}
          {clock.format(time)}
        </time>
        <span
          className="automation-run-status"
          data-status={run.status}
          role="img"
          aria-label={statusLabel}
          title={statusLabel}
        >
          {run.status !== "running" && (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={statusPaths[run.status]} />
            </svg>
          )}
        </span>
      </span>
    </>
  );
  return (
    <div className="automation-run">
      {run.sessionId ? (
        <button
          className="automation-run-open"
          type="button"
          onClick={() =>
            useWorkspace.getState().open({ id: run.sessionId!, workspaceId: run.input.projectId })
          }
        >
          {contents}
        </button>
      ) : (
        <div className="automation-run-open">{contents}</div>
      )}
      {!running && (
        <div className="automation-run-actions">
          <ActionButton
            type="button"
            className="icon ghost"
            disabled={busy}
            aria-label={t(run.archived ? "scheduleRestoreRun" : "scheduleArchiveRun")}
            title={t(run.archived ? "scheduleRestoreRun" : "scheduleArchiveRun")}
            onClick={archive}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={
                  run.archived
                    ? "M4 8h16v12H4zM12 15V3m-4 4 4-4 4 4"
                    : "M3 4h18v5H3zM5 9v11h14V9M9 13h6"
                }
              />
            </svg>
          </ActionButton>
          <ActionButton
            type="button"
            className="icon ghost"
            disabled={busy}
            aria-label={t("deletePermanently")}
            title={t("deletePermanently")}
            onClick={remove}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6" />
            </svg>
          </ActionButton>
        </div>
      )}
    </div>
  );
};
