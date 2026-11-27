import { expect, test } from "vitest";
import { latestOccurrence, nextOccurrence } from "./time";

test.each([
  ["FREQ=HOURLY;INTERVAL=5;BYMINUTE=30", "2026-01-02T00:00Z", "2026-01-02T01:30Z"],
  ["FREQ=MONTHLY;BYMONTHDAY=31;BYHOUR=9;BYMINUTE=0", "2026-02-01T00:00Z", "2026-03-31T09:00Z"],
  [
    "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;BYHOUR=9;BYMINUTE=0",
    "2026-02-01T00:00Z",
    "2028-02-29T09:00Z",
  ],
  [
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;BYHOUR=9;BYMINUTE=0",
    "2026-01-08T00:00Z",
    "2026-01-12T09:00Z",
  ],
])("previews and recovers %s", (rule, after, expected) => {
  const trigger = {
    kind: "rrule",
    rule,
    timezone: "UTC",
    anchorAt: Date.parse("2026-01-01T00:00Z"),
  } as const;
  expect(nextOccurrence(trigger, Date.parse(after))).toBe(Date.parse(expected));
  expect(latestOccurrence(trigger, Date.parse(expected), trigger.anchorAt)).toBe(
    Date.parse(expected),
  );
});
test("custom daily stays at local time across spring DST", () => {
  const trigger = {
    kind: "rrule",
    rule: "FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=0",
    timezone: "America/New_York",
    anchorAt: Date.parse("2026-03-06T15:00Z"),
  } as const;
  expect(nextOccurrence(trigger, trigger.anchorAt)).toBe(Date.parse("2026-03-08T13:00Z"));
});
