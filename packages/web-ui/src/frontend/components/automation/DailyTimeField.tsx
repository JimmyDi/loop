import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScheduleSelect } from "./ScheduleSelect";
import "./DailyTimeField.css";

const presets = Array.from({ length: 96 }, (_, i) => {
  const hour = String(Math.floor(i / 4)).padStart(2, "0");
  const minute = String((i % 4) * 15).padStart(2, "0");
  return hour + ":" + minute;
});

export const DailyTimeField = ({ initial }: { initial: string }) => {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [time, setTime] = useState(initial);
  const format = new Intl.DateTimeFormat(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return (
    <div className="daily-time-field">
      <label htmlFor={id}>{t("scheduleTime")}</label>
      <input
        id={id}
        name="time"
        type="time"
        required
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      <ScheduleSelect
        aria-label={t("scheduleChooseTime")}
        value={time}
        onChange={(event) => setTime(event.target.value)}
      >
        {(presets.includes(time) ? presets : [time, ...presets]).map((value) => (
          <option key={value} value={value}>
            {value ? format.format(new Date("2000-01-01T" + value + "Z")) : t("scheduleChooseTime")}
          </option>
        ))}
      </ScheduleSelect>
    </div>
  );
};
