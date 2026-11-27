import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { IntervalFields } from "./IntervalFields";

test("restores hours and opens older intervals in minutes", () => {
  const interval = { kind: "interval", anchorAt: 0, everyMs: 59940000 } as const;
  const hours = renderToStaticMarkup(<IntervalFields trigger={{ ...interval, unit: "hours" }} />);
  expect(hours).toContain('value="16.65"');
  expect(hours).toContain('value="hours" selected');
  const minutes = renderToStaticMarkup(<IntervalFields trigger={interval} />);
  expect(minutes).toContain('value="999"');
  expect(minutes).toContain('value="minutes" selected');
});
