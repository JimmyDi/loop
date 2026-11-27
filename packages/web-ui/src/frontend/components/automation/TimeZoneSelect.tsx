import { ScheduleSelect } from "./ScheduleSelect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./TimeZoneSelect.css";

// Keep saved aliases selectable even when Intl lists only their canonical names.
const timeZoneOptions = (selected: string, date = new Date()) => {
  const zones = new Set(["UTC", selected, ...Intl.supportedValuesOf("timeZone")]);
  return [...zones].sort().map((zone) => {
    const offset = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")!.value;
    const label = offset === "GMT" ? "UTC+00:00" : offset.replace("GMT", "UTC");
    return { zone, label: zone + " (" + label + ")" };
  });
};

export const TimeZoneSelect = ({ saved }: { saved?: string }) => {
  const { t } = useTranslation();
  const zone = saved ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const options = useMemo(
    () =>
      timeZoneOptions(zone).map(({ zone, label }) => (
        <option key={zone} value={zone}>
          {label}
        </option>
      )),
    [zone],
  );
  return (
    <label>
      {t("scheduleTimezone")}
      <ScheduleSelect className="schedule-time-zone" name="timezone" required defaultValue={zone}>
        {options}
      </ScheduleSelect>
    </label>
  );
};
