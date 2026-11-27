import { CronExpressionParser } from "cron-parser";
import { isPermissionPreset } from "../permissions/types";
import { recurrenceOccurrence } from "./recurrence";
import type { ScheduleInput, ScheduleTrigger } from "./types";

export class ScheduleInputError extends Error {}

const validTime = (value: number) =>
  Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());

export const nextOccurrence = (trigger: ScheduleTrigger, after: number): number | null => {
  switch (trigger?.kind) {
    case "rrule":
      try {
        return recurrenceOccurrence(trigger, after, "next");
      } catch {
        throw new ScheduleInputError("Invalid recurrence rule, start time or timezone");
      }
    case "once":
      if (validTime(trigger.at)) return trigger.at > after ? trigger.at : null;
      break;
    case "interval": {
      if (
        !validTime(trigger.anchorAt) ||
        !Number.isSafeInteger(trigger.everyMs) ||
        trigger.everyMs < 60_000
      )
        break;
      const n = Math.max(0, Math.floor((after - trigger.anchorAt) / trigger.everyMs) + 1);
      const next = trigger.anchorAt + n * trigger.everyMs;
      if (validTime(next)) return next;
      break;
    }
    case "cron":
      try {
        if (
          !trigger.timezone ||
          typeof trigger.timezone !== "string" ||
          /[^0-9*,/\s-]/.test(trigger.expression) ||
          trigger.expression.trim().split(/\s+/).length !== 5
        )
          break;
        new Intl.DateTimeFormat("en", { timeZone: trigger.timezone });
        return CronExpressionParser.parse(trigger.expression, {
          tz: trigger.timezone,
          currentDate: after,
        })
          .next()
          .getTime();
      } catch {
        break;
      }
  }
  throw new ScheduleInputError("Invalid schedule time, interval or timezone");
};

export const latestOccurrence = (trigger: ScheduleTrigger, now: number, first: number) => {
  if (trigger.kind === "rrule")
    return Math.max(first, recurrenceOccurrence(trigger, now, "previous") ?? first);
  if (trigger.kind === "once") return first;
  if (trigger.kind === "interval")
    return (
      trigger.anchorAt + Math.floor((now - trigger.anchorAt) / trigger.everyMs) * trigger.everyMs
    );
  return Math.max(
    first,
    CronExpressionParser.parse(trigger.expression, { tz: trigger.timezone, currentDate: now + 1 })
      .prev()
      .getTime(),
  );
};

export const checkDefinition = (value: ScheduleInput) => {
  if (
    !value ||
    [value.name, value.prompt, value.projectId].some((v) => typeof v !== "string" || !v.trim()) ||
    !isPermissionPreset(value.permission) ||
    !["run-once", "skip", "ask"].includes(value.missed) ||
    (value.missed === "ask" && value.trigger?.kind !== "once")
  )
    throw new ScheduleInputError("Invalid schedule definition");
};

export const validateSchedule = (value: ScheduleInput, now: number) => {
  checkDefinition(value);
  const next = nextOccurrence(value.trigger, now);
  if (next === null) throw new ScheduleInputError("Choose a future time");
  return next;
};
