import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ComposerPlanControls } from "./ComposerPlanControls";
import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";

test("plan chip follows permissions and respects running state", () => {
  const snapshot = {
    sessionId: "s",
    state: { permissionPreset: "danger-full-access", planning: { mode: "plan", plans: [] } },
  } as unknown as SessionSnapshot;
  const html = renderToStaticMarkup(
    <ComposerPlanControls
      snapshot={snapshot}
      blocked={false}
      running
      imageCount={0}
      fileCount={0}
      add={() => {}}
      planning={{ change: () => {} }}
      permission={{ pending: false, change: async () => true }}
    />,
  );
  expect(html.indexOf("permission-trigger")).toBeLessThan(html.indexOf("composer-plan-item"));
  expect(html).toContain("composer-plan-item");
  expect(html).toContain('disabled=""');
});
