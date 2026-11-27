import { expect, test } from "vitest";
import { latestOccurrence, nextOccurrence } from "./time";

test("90 minute intervals retain the anchor across midnight and missed runs", () => {
  const trigger = { kind: "interval", anchorAt: 1, everyMs: 90 * 60_000 } as const;
  const now = trigger.everyMs * 19 + 10;
  expect(latestOccurrence(trigger, now, 1)).toBe(trigger.everyMs * 19 + 1);
  expect(nextOccurrence(trigger, now)).toBe(trigger.everyMs * 20 + 1);
});
test("zoned weekday calendar follows DST and rejects malformed or randomized calendars", () => {
  const trigger = {
    kind: "cron",
    expression: "0 9 * * 1-5",
    timezone: "America/New_York",
  } as const;
  expect(nextOccurrence(trigger, Date.parse("2026-03-06T16:00:00Z"))).toBe(
    Date.parse("2026-03-09T13:00:00Z"),
  );
  expect(() => nextOccurrence({ ...trigger, timezone: "Invalid/Zone" }, 1)).toThrow();
  expect(() => nextOccurrence({ ...trigger, expression: "H * * * *" }, 1)).toThrow();
  expect(nextOccurrence({ kind: "once", at: 5 }, 5)).toBeNull();
});
