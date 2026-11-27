import type { ScheduleTrigger } from "../../../shared/schedules";

export type Frequency = ScheduleTrigger["kind"] | "daily" | "weekdays" | "weekly" | "custom";

export const formTrigger = (
  kind: Frequency,
  value: (key: string) => string,
  existing?: ScheduleTrigger,
): ScheduleTrigger => {
  switch (kind) {
    case "custom":
    case "rrule": {
      const unit = value("unit");
      const [hour, minute] = value("time").split(":").map(Number);
      const parts = ["FREQ=" + unit, "INTERVAL=" + value("every")];
      if (unit === "WEEKLY") parts.push("BYDAY=" + value("days"));
      if (unit === "YEARLY") parts.push("BYMONTH=" + value("months"));
      if (unit === "MONTHLY" || unit === "YEARLY") parts.push("BYMONTHDAY=" + value("dates"));
      if (unit !== "HOURLY") parts.push("BYHOUR=" + hour);
      parts.push("BYMINUTE=" + (unit === "HOURLY" ? value("minute") : minute));
      return {
        kind: "rrule",
        rule: kind === "rrule" ? value("rule").trim().toUpperCase() : parts.join(";"),
        timezone: value("timezone"),
        anchorAt: existing?.kind === "rrule" ? existing.anchorAt : Date.now(),
      };
    }
    case "weekly":
    case "weekdays":
    case "daily": {
      const [hour, minute] = value("time").split(":");
      return {
        kind: "cron",
        expression:
          Number(minute) +
          " " +
          Number(hour) +
          " * * " +
          (kind === "weekly" ? value("weekday") : kind === "weekdays" ? "1-5" : "*"),
        timezone: value("timezone"),
      };
    }
    case "cron":
      return { kind, expression: value("cron"), timezone: value("timezone") };
    case "once":
      return { kind, at: new Date(value("at")).getTime() };
    case "interval": {
      const hours = value("intervalUnit") === "hours";
      const everyMs = Math.round(Number(value("amount")) * (hours ? 3_600_000 : 60_000));
      const anchorAt =
        existing?.kind === "interval" && existing.everyMs === everyMs
          ? existing.anchorAt
          : Date.now() + everyMs;
      return hours ? { kind, everyMs, anchorAt, unit: "hours" } : { kind, everyMs, anchorAt };
    }
  }
};

export const localDateTime = (trigger?: ScheduleTrigger) => {
  if (trigger?.kind !== "once") return "";
  const date = new Date(trigger.at);
  return new Date(trigger.at - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const repeatDefaults = (trigger?: ScheduleTrigger) => {
  if (trigger?.kind === "rrule") {
    const parts = Object.fromEntries(trigger.rule.split(";").map((part) => part.split("=")));
    const value = (key: string) =>
      ({
        unit: parts.FREQ,
        every: parts.INTERVAL,
        days: parts.BYDAY,
        dates: parts.BYMONTHDAY,
        months: parts.BYMONTH,
        minute: parts.BYMINUTE,
        time: (parts.BYHOUR ?? "9") + ":" + parts.BYMINUTE,
        timezone: trigger.timezone,
      })[key] ?? "";
    const rebuilt = formTrigger("custom", value, trigger);
    if (
      rebuilt.kind === "rrule" &&
      rebuilt.rule === trigger.rule &&
      ["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ ?? "") &&
      /^\d+$/.test(parts.BYMINUTE ?? "") &&
      (!parts.BYDAY || parts.BYDAY.split(",").every((day: string) => weekdays.includes(day))) &&
      (!parts.BYMONTHDAY ||
        parts.BYMONTHDAY.split(",").every(
          (day: string) => /^[1-9]\d?$/.test(day) && Number(day) <= 31,
        )) &&
      (!parts.BYMONTH ||
        parts.BYMONTH.split(",").every(
          (month: string) => /^[1-9]\d?$/.test(month) && Number(month) <= 12,
        )) &&
      Number(parts.INTERVAL) >= 1 &&
      Number(parts.INTERVAL) <= 999 &&
      (!parts.BYHOUR || /^\d+$/.test(parts.BYHOUR))
    )
      return {
        kind: "custom" as Frequency,
        parts,
        time: (parts.BYHOUR ?? "9").padStart(2, "0") + ":" + parts.BYMINUTE!.padStart(2, "0"),
      };
  }
  const cron =
    trigger?.kind === "cron" &&
    /^(\d|[1-5]\d) (\d|1\d|2[0-3]) \* \* (\*|1-5|[0-6])$/.exec(trigger.expression);
  if (cron)
    return {
      kind: (cron[3] === "*" ? "daily" : cron[3] === "1-5" ? "weekdays" : "weekly") as Frequency,
      time: cron[2]!.padStart(2, "0") + ":" + cron[1]!.padStart(2, "0"),
      weekday: cron[3],
    };
  return { kind: trigger?.kind ?? ("daily" as Frequency), time: "09:00" };
};

export const units = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
export const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const frequencies = {
  interval: "scheduleInterval",
  daily: "scheduleDaily",
  weekdays: "scheduleWeekdays",
  weekly: "scheduleWeekly",
  custom: "scheduleCustom",
  rrule: "scheduleRule",
  cron: "Cron",
  once: "scheduleOnce",
};
