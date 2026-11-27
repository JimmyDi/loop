import { RRuleTemporal } from "rrule-temporal";
import type { ScheduleTrigger } from "./types";

export const recurrenceOccurrence = (
  trigger: Extract<ScheduleTrigger, { kind: "rrule" }>,
  instant: number,
  direction: "next" | "previous",
) => {
  const { rule, timezone, anchorAt } = trigger;
  if (
    typeof rule !== "string" ||
    rule.length > 512 ||
    !/^[A-Z0-9=;,+:\-]+$/.test(rule) ||
    /[\r\n]/.test(rule) ||
    !Number.isSafeInteger(anchorAt) ||
    typeof timezone !== "string" ||
    !timezone ||
    !/^[A-Za-z0-9+_\-/]+$/.test(timezone)
  )
    throw new Error("Invalid recurrence");
  const expression = rule.replace(/^RRULE:/, "");
  if (
    !/(?:^|;)FREQ=(HOURLY|DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/.test(expression) ||
    /(?:^|;)BYSECOND=(?!0(?:;|$))/.test(expression)
  )
    throw new Error("Unsupported recurrence");
  const format = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const start = format.format(anchorAt).replace(/[-:]/g, "").replace(" ", "T") + "00";
  const recurrence = new RRuleTemporal({
    rruleString: "DTSTART;TZID=" + timezone + ":" + start + "\nRRULE:" + expression,
    strict: true,
    includeDtstart: false,
    maxCandidateEvaluations: 20000,
  });
  const date = new Date(instant);
  const occurrence = direction === "next" ? recurrence.next(date) : recurrence.previous(date, true);
  return occurrence?.epochMilliseconds ?? null;
};
