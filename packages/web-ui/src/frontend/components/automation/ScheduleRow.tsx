import { repeatDefaults } from "./schedule-form-trigger";
import type { TFunction } from "i18next";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Schedule } from "../../../shared/schedules";
import { useProjectMenu } from "../../hooks/useProjectMenu";
import "./ScheduleRow.css";

export type ScheduleAction = "run" | "cancel" | "pause" | "resume" | "delete";

const statusPaths = {
  active: "M8 4v4l3 2",
  queued: "M5 4h6M5 12h6M5 4c0 3 2 3 3 4-1 1-3 1-3 4m6-8c0 3-2 3-3 4 1 1 3 1 3 4",
  running: "M6 4.5v7l5.5-3.5z",
  paused: "M6 5v6m4-6v6",
  completed: "m4.5 8 2.5 2.5 4.5-5",
  missed: "M8 4.5v4m0 2.5v.2",
};

const repeatSummary = (trigger: Schedule["trigger"], locale: string, t: TFunction) => {
  if (trigger.kind === "once")
    return new Date(trigger.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  if (trigger.kind === "rrule") return trigger.rule;
  if (trigger.kind === "interval") {
    const hours = trigger.unit === "hours";
    const duration = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: hours ? "hour" : "minute",
      unitDisplay: "long",
      maximumFractionDigits: 6,
    }).format(trigger.everyMs / (hours ? 3600000 : 60000));
    return t("scheduleEveryDuration", { duration });
  }
  const preset = repeatDefaults(trigger);
  if (preset.kind === "daily") return t("scheduleDaily") + " " + preset.time;
  if (preset.kind === "weekdays") return t("scheduleWeekdays") + " " + preset.time;
  if (preset.kind === "weekly") {
    const day = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
      Date.UTC(2023, 0, 1 + Number(preset.weekday)),
    );
    return t("scheduleWeekly") + " · " + day + " " + preset.time;
  }
  return trigger.expression;
};

const relativeTime = (next: number, now: number, locale: string) => {
  const remaining = Math.max(0, next - now);
  if (remaining < 60_000)
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      Math.ceil(remaining / 1000),
      "second",
    );
  const [unit, divisor] =
    remaining >= 86400000
      ? (["day", 86400000] as const)
      : remaining >= 3600000
        ? (["hour", 3600000] as const)
        : (["minute", 60000] as const);
  return new Intl.RelativeTimeFormat(locale).format(Math.floor(remaining / divisor), unit);
};

export const ScheduleRow = ({
  plan,
  project,
  now = Date.now(),
  busy,
  edit,
  change,
}: {
  plan: Schedule;
  project?: string;
  now?: number;
  busy: boolean;
  edit(): void;
  change(action: ScheduleAction): void;
}) => {
  const { t, i18n } = useTranslation();
  const menu = useProjectMenu();
  const run = plan.activeRun ? "cancel" : "run";
  const label = t("scheduleMore", { name: plan.name });
  const toggle =
    plan.status === "paused" ? "resume" : plan.status === "active" ? "pause" : undefined;
  const choose = (action: ScheduleAction) => {
    menu.close();
    change(action);
  };
  const status =
    plan.activeRun?.status === "running"
      ? "running"
      : plan.activeRun?.status === "queued"
        ? "queued"
        : plan.status;
  const summary = repeatSummary(plan.trigger, i18n.language, t);
  return (
    <li
      className="schedule-row"
      onClick={(event) => {
        const target = event.target as Element;
        if (!busy && event.currentTarget.contains(target) && !target.closest("button")) edit();
      }}
    >
      {status !== "deleted" && (
        <svg
          className="schedule-status-icon"
          data-status={status}
          viewBox="0 0 16 16"
          role="img"
          aria-label={t("scheduleStatus_" + status)}
        >
          <title>{t("scheduleStatus_" + status)}</title>
          <circle cx="8" cy="8" r="7" />
          <path d={statusPaths[status]} />
        </svg>
      )}
      <button className="schedule-row-name" onClick={edit} disabled={busy} title={plan.name}>
        {plan.name}
      </button>
      {project && (
        <span className="schedule-row-project" title={project}>
          {project}
        </span>
      )}
      <span
        className="schedule-row-repeat"
        title={"timezone" in plan.trigger ? summary + " · " + plan.trigger.timezone : summary}
      >
        {summary}
      </span>
      <span className="schedule-row-status">
        {plan.status === "active" && plan.next !== null ? (
          <time
            dateTime={new Date(plan.next).toISOString()}
            title={new Date(plan.next).toLocaleString(i18n.language)}
          >
            {t("scheduleRunsRelative", { when: relativeTime(plan.next, now, i18n.language) })}
          </time>
        ) : (
          t("scheduleStatus_" + plan.status)
        )}
      </span>
      <div className="schedule-row-actions" data-open={menu.open}>
        <button
          disabled={busy}
          title={t("scheduleAction_" + run)}
          aria-label={t("scheduleAction_" + run)}
          onClick={() => change(run)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {run === "run" ? (
              <path d="M6 4.5v15l13-7.5z" />
            ) : (
              <rect x="5" y="5" width="14" height="14" rx="2" />
            )}
          </svg>
        </button>
        <button
          disabled={busy}
          ref={menu.trigger}
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={menu.open}
          onClick={() => menu.setOpen(!menu.open)}
        >
          •••
        </button>
      </div>
      {menu.open &&
        createPortal(
          <div
            className="schedule-row-menu"
            role="menu"
            aria-label={label}
            ref={menu.panel}
            onKeyDown={menu.navigate}
            style={menu.position}
          >
            {toggle && (
              <button role="menuitem" onClick={() => choose(toggle)}>
                {t("scheduleAction_" + toggle)}
              </button>
            )}
            <button role="menuitem" onClick={() => choose("delete")}>
              {t("scheduleAction_delete")}
            </button>
          </div>,
          document.body,
        )}
    </li>
  );
};
