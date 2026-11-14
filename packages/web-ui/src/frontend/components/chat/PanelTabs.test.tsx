import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PanelTabs } from "./PanelTabs";
import "../../i18n/setup";
test("tab labels omit version suffixes", () => {
  expect(
    renderToStaticMarkup(
      <PanelTabs
        tabs={[{ id: "p", title: "Plan", content: null }]}
        active="p"
        select={() => {}}
        close={() => {}}
      />,
    ),
  ).toContain("Plan");
});
