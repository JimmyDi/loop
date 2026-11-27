import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleTrigger } from "../../../shared/schedules";
import { api } from "../../lib/api";
import { ErrorNotice } from "../ui/ErrorNotice";
import { formTrigger } from "./schedule-form-trigger";
import type { Frequency } from "./schedule-form-trigger";
import "./SchedulePreview.css";

export const SchedulePreview = ({
  form,
  kind,
  existing,
}: {
  form: RefObject<HTMLFormElement | null>;
  kind: Frequency;
  existing?: ScheduleTrigger;
}) => {
  const { t, i18n } = useTranslation();
  const [times, setTimes] = useState<number[] | null>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    const element = form.current;
    if (!element || element.querySelector(".repeat-fields :invalid")) {
      setTimes(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const fields = new FormData(element);
        const trigger = formTrigger(kind, (name) => fields.getAll(name).join(","), existing);
        const result = await api<number[]>("/schedules/preview", {
          method: "POST",
          body: JSON.stringify({ trigger, limit: 4 }),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setTimes(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form, kind, existing]);
  if (error) return <ErrorNotice error={error} />;
  if (times === null) return null;
  if (times === undefined) return <p role="status">{t("scheduleCalculating")}</p>;
  if (!times.length) return <p>{t("scheduleNoFuture")}</p>;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { timeStyle: "medium" });
  return (
    <div className="schedule-preview-card">
      <ol>
        {times.slice(0, 3).map((time) => (
          <li key={time}>
            <time dateTime={new Date(time).toISOString()}>
              <span>{dateFormat.format(time)}</span> <strong>{timeFormat.format(time)}</strong>
            </time>
          </li>
        ))}
      </ol>
      {times.length > 3 && (
        <p className="schedule-preview-more" role="note" aria-label={t("scheduleMoreRuns")}>
          …
        </p>
      )}
    </div>
  );
};
