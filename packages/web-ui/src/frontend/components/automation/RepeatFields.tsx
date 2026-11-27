import { DailyTimeField } from "./DailyTimeField";
import { IntervalFields } from "./IntervalFields";
import { ScheduleSelect } from "./ScheduleSelect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleTrigger } from "../../../shared/schedules";
import {
  localDateTime,
  repeatDefaults,
  units,
  weekdays,
  frequencies,
} from "./schedule-form-trigger";
import type { Frequency } from "./schedule-form-trigger";
import { RepeatChoices } from "./RepeatChoices";
import { TimeZoneSelect } from "./TimeZoneSelect";
import "./RepeatFields.css";

export const RepeatFields = ({
  kind,
  setKind,
  trigger,
}: {
  kind: Frequency;
  setKind: (value: Frequency) => void;
  trigger?: ScheduleTrigger;
}) => {
  const { t, i18n } = useTranslation();
  const initial = repeatDefaults(trigger);
  const parts = initial.parts ?? {};
  const [unit, setUnit] = useState(parts.FREQ ?? "HOURLY");
  const custom = kind === "custom";
  const hourly = custom && unit === "HOURLY";
  const dayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: "long", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat(i18n.language, { month: "long", timeZone: "UTC" });
  const dayName = (i: number) => dayFormat.format(Date.UTC(2024, 0, i + 1));
  const monthName = (i: number) => monthFormat.format(Date.UTC(2024, i, 1));
  const choices = (
    name: string,
    label: string,
    values: string[],
    labels: string[],
    selected: string,
  ) => (
    <RepeatChoices
      key={name}
      name={name}
      label={t(label)}
      values={values}
      labels={labels}
      initial={selected}
    />
  );
  const dates = Array.from({ length: 31 }, (_, i) => String(i + 1));
  return (
    <div className="schedule-fields repeat-fields">
      <label>
        {t("scheduleFrequency")}
        <ScheduleSelect value={kind} onChange={(event) => setKind(event.target.value as Frequency)}>
          {Object.entries(frequencies).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </ScheduleSelect>
      </label>
      {custom && (
        <>
          <label>
            {t("scheduleRepeats")}
            <ScheduleSelect
              name="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {units.map((value) => (
                <option key={value} value={value}>
                  {t("scheduleUnit" + value)}
                </option>
              ))}
            </ScheduleSelect>
          </label>
          <label>
            {t("scheduleEvery")}
            <input
              name="every"
              type="number"
              min="1"
              max="999"
              required
              defaultValue={parts.INTERVAL ?? 1}
            />
          </label>
        </>
      )}
      {kind === "interval" && <IntervalFields trigger={trigger} />}
      {kind === "once" && (
        <label>
          {t("scheduleAt")}
          <input name="at" type="datetime-local" required defaultValue={localDateTime(trigger)} />
        </label>
      )}
      {kind === "weekly" && (
        <label>
          {t("scheduleOn")}
          <ScheduleSelect
            name="weekday"
            defaultValue={initial.kind === "weekly" ? initial.weekday : "1"}
          >
            {weekdays.map((day, i) => (
              <option key={day} value={(i + 1) % 7}>
                {dayName(i)}
              </option>
            ))}
          </ScheduleSelect>
        </label>
      )}
      {custom &&
        unit === "WEEKLY" &&
        choices(
          "days",
          "scheduleOn",
          weekdays,
          weekdays.map((_, i) => dayName(i)),
          parts.BYDAY ?? weekdays.join(","),
        )}
      {custom &&
        unit === "YEARLY" &&
        choices(
          "months",
          "scheduleMonths",
          dates.slice(0, 12),
          dates.slice(0, 12).map((_, i) => monthName(i)),
          parts.BYMONTH ?? "1",
        )}
      {custom &&
        (unit === "MONTHLY" || unit === "YEARLY") &&
        choices("dates", "scheduleDates", dates, dates, parts.BYMONTHDAY ?? "1")}
      {hourly && (
        <label>
          {t("scheduleMinute")}
          <input
            name="minute"
            type="number"
            required
            min="0"
            max="59"
            defaultValue={parts.BYMINUTE ?? 30}
          />
        </label>
      )}
      {kind === "daily" && <DailyTimeField initial={initial.time} />}
      {["weekly", "weekdays", "custom"].includes(kind) && !hourly && (
        <label>
          {t(custom ? "scheduleStartTime" : "scheduleTime")}
          <input name="time" type="time" required defaultValue={initial.time} />
        </label>
      )}
      {kind === "rrule" && (
        <label>
          {t("scheduleRule")}
          <input
            name="rule"
            required
            defaultValue={
              trigger?.kind === "rrule"
                ? trigger.rule
                : "FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0"
            }
          />
        </label>
      )}
      {kind === "cron" && (
        <label>
          Cron
          <input
            required
            name="cron"
            defaultValue={trigger?.kind === "cron" ? trigger.expression : "0 9 * * 1-5"}
          />
        </label>
      )}
      {kind !== "once" && kind !== "interval" && (
        <TimeZoneSelect saved={trigger && "timezone" in trigger ? trigger.timezone : undefined} />
      )}
    </div>
  );
};
