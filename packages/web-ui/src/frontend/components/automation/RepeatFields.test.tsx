import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { RepeatFields } from "./RepeatFields";

test.each([
  ["HOURLY", "BYMINUTE=30", "minute"],
  ["DAILY", "BYHOUR=9;BYMINUTE=5", "time"],
  ["WEEKLY", "BYDAY=MO,WE;BYHOUR=9;BYMINUTE=5", "days"],
  ["MONTHLY", "BYMONTHDAY=1,15;BYHOUR=9;BYMINUTE=5", "dates"],
  ["YEARLY", "BYMONTH=3,6;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=5", "months"],
])("restores custom %s fields in the editor", (unit, by, name) => {
  const html = renderToStaticMarkup(
    <RepeatFields
      kind="custom"
      setKind={() => {}}
      trigger={{
        kind: "rrule",
        rule: "FREQ=" + unit + ";INTERVAL=2;" + by,
        timezone: "UTC",
        anchorAt: 0,
      }}
    />,
  );
  expect(html).toContain('value="' + unit + '" selected');
  expect(html).toContain('name="' + name + '"');
  expect(html).toContain('value="2"');
});
