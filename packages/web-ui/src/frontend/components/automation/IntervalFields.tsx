import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleTrigger } from "../../../shared/schedules";
import { ScheduleSelect } from "./ScheduleSelect";
import "./IntervalFields.css";

export const IntervalFields = ({ trigger }: { trigger?: ScheduleTrigger }) => {
  const { t } = useTranslation();
  const interval = trigger?.kind === "interval" ? trigger : undefined;
  const [intervalUnit, setIntervalUnit] = useState(interval?.unit ?? "minutes");
  return (
    <div className="repeat-interval">
      <label>
        {t("scheduleEvery")}
        <input
          name="amount"
          required
          type="number"
          step="any"
          min={intervalUnit === "hours" ? 1 / 60 : 1}
          defaultValue={
            interval ? interval.everyMs / (interval.unit === "hours" ? 3600000 : 60000) : 60
          }
        />
      </label>
      <label>
        <span className="interval-unit-label">{t("scheduleIntervalUnit")}</span>
        <ScheduleSelect
          name="intervalUnit"
          value={intervalUnit}
          onChange={(event) =>
            setIntervalUnit(event.target.value === "hours" ? "hours" : "minutes")
          }
        >
          <option value="minutes">{t("scheduleMinutes")}</option>
          <option value="hours">{t("scheduleHours")}</option>
        </ScheduleSelect>
      </label>
    </div>
  );
};
