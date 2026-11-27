import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { TimeZoneSelect } from "./TimeZoneSelect";

test("keeps a saved alias selected and shows regional offsets", () => {
  const html = renderToStaticMarkup(<TimeZoneSelect saved="Asia/Calcutta" />);
  expect(html).toContain('value="Asia/Calcutta" selected="">Asia/Calcutta (UTC+05:30)');
  expect(html).toContain("Asia/Shanghai (UTC+08:00)");
  expect(html).toContain("UTC (UTC+00:00)");
});
