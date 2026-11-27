import { SchedulePreview } from "./SchedulePreview";
import { ScheduleSelect } from "./ScheduleSelect";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schedule, ScheduleInput } from "../../../shared/schedules";
import type { Project } from "../../../shared/protocol";
import { formTrigger, repeatDefaults } from "./schedule-form-trigger";
import { RepeatFields } from "./RepeatFields";
import type { Frequency } from "./schedule-form-trigger";
import "./ScheduleForm.css";

export const ScheduleForm = ({
  plan,
  projects,
  busy,
  error,
  save,
  cancel,
  onAction,
}: {
  plan?: Schedule;
  projects: Project[];
  busy: boolean;
  error?: unknown;
  save: (input: ScheduleInput) => void;
  cancel: () => void;
  onAction?: (action: "run" | "delete") => void;
}) => {
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const { t } = useTranslation();
  const [kind, setKind] = useState<Frequency>(() => repeatDefaults(plan?.trigger).kind);
  const [prompt, setPrompt] = useState(plan?.prompt ?? "");
  const accessibleProjects = projects.filter((project) => project.accessible);
  const existing = plan?.trigger;
  const canSave = !busy && !!prompt.trim() && accessibleProjects.length > 0;
  return (
    <>
      <header className="automation-toolbar">
        <nav className="schedule-breadcrumb" aria-label={t("scheduleBreadcrumb")}>
          <button type="button" onClick={cancel} disabled={busy}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 8v5l3 2M2 6l4-4m12 0 4 4M6 19l-2 3m14-3 2 3" />
            </svg>
            {t("scheduleHome")}
          </button>
          <span aria-hidden="true">/</span>
          <h1 aria-current="page">{plan?.name ?? t("scheduleCreateTitle")}</h1>
        </nav>
        <div className="schedule-editor-actions">
          {plan && onAction && (
            <>
              <ActionButton
                className="ghost automation-action"
                disabled={busy || !!plan.activeRun}
                onClick={() => onAction("run")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4.5v15l13-7.5z" />
                </svg>
                {t("scheduleRunNow")}
              </ActionButton>
              <ActionButton
                className="ghost automation-action"
                disabled={busy}
                onClick={() => onAction("delete")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6" />
                </svg>
                {t("scheduleAction_delete")}
              </ActionButton>
            </>
          )}
          <ActionButton className="ghost automation-action" onClick={cancel} disabled={busy}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
            {t("cancel")}
          </ActionButton>
          <ActionButton
            className="ghost automation-action"
            type="submit"
            form={formId}
            disabled={!canSave}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
            {t("save")}
          </ActionButton>
        </div>
      </header>
      <form
        ref={form}
        id={formId}
        onChange={(event) => {
          if ((event.target as Element).closest(".repeat-fields"))
            setScheduleRevision((n) => n + 1);
        }}
        className="schedule-form"
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const value = (name: string) => fields.getAll(name).join(",");
          const trigger = formTrigger(kind, value, existing);
          const permission = value("permission");
          save({
            name: value("name").trim() || prompt.trim().split(/\r?\n/)[0]!.slice(0, 80),
            projectId: value("project"),
            prompt: value("prompt"),
            permission:
              permission === "workspace-write" || permission === "danger-full-access"
                ? permission
                : "read-only",
            trigger,
            missed: value("missed") as ScheduleInput["missed"],
          });
        }}
      >
        <div className="schedule-editor-fields">
          <section>
            <h2>{t("scheduleBasics")}</h2>
            <textarea
              className="schedule-instructions"
              required
              name="prompt"
              aria-label={t("scheduleInstructionsLabel")}
              placeholder={t("scheduleInstructions")}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <RepeatFields kind={kind} setKind={setKind} trigger={existing} />
          </section>
          <section>
            <h2>{t("scheduleAdvanced")}</h2>
            <div className="schedule-fields">
              <label>
                {t("scheduleName")}
                <input name="name" defaultValue={plan?.name} />
              </label>
              <label>
                {t("scheduleProject")}
                <ScheduleSelect required name="project" defaultValue={plan?.projectId}>
                  {accessibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </ScheduleSelect>
              </label>
              <label>
                {t("scheduleAccess")}
                <ScheduleSelect
                  aria-label={t("scheduleAccess")}
                  name="permission"
                  defaultValue={plan?.permission ?? "read-only"}
                >
                  <option value="read-only">{t("scheduleReadOnly")}</option>
                  <option value="workspace-write">{t("scheduleWrite")}</option>
                  <option value="danger-full-access">{t("permissions.danger-full-access")}</option>
                </ScheduleSelect>
              </label>
              <label>
                {t("scheduleMissed")}
                <ScheduleSelect
                  key={kind}
                  name="missed"
                  defaultValue={plan?.missed ?? (kind === "once" ? "ask" : "run-once")}
                >
                  <option value="run-once">{t("scheduleCatchUp")}</option>
                  <option value="skip">{t("scheduleSkip")}</option>
                  {kind === "once" && <option value="ask">{t("scheduleAsk")}</option>}
                </ScheduleSelect>
              </label>
            </div>
          </section>
          {accessibleProjects.length === 0 && <p>{t("scheduleNeedsProject")}</p>}
          <ErrorNotice error={error} />
          <section className="schedule-preview">
            <h2>{t("scheduleNextRuns")}</h2>
            <SchedulePreview key={scheduleRevision} form={form} kind={kind} existing={existing} />
          </section>
        </div>
      </form>
    </>
  );
};
