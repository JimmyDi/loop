import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ComposerPlanControls } from "./ComposerPlanControls";
import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";

test("remote-only composer hides Plan but retains attachments and permissions", () => {
  const html = renderToStaticMarkup(
    <ComposerPlanControls
      snapshot={
        {
          sessionId: "echo",
          state: { remoteOnly: true, permissionPreset: "read-only" },
        } as SessionSnapshot
      }
      blocked={false}
      running={false}
      imageCount={0}
      fileCount={0}
      add={() => {}}
      planning={{ change: () => {} }}
      permission={{ pending: false, change: async () => true }}
    />,
  );
  expect(html).toContain("permission-trigger");
  expect(html).toContain("composer-add-trigger");
  expect(html).not.toContain("composer-plan-item");
});

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
