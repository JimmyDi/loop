import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { SessionPlanBadge } from "./SessionPlanBadge";
import type { SessionSummary } from "../../../shared/protocol";
import "../../i18n/setup";

test("session plan badge reports planning and ready states", () => {
  const session = { id: "s", isPlanning: true } as SessionSummary;
  expect(renderToStaticMarkup(<SessionPlanBadge session={session} />)).toContain('role="status"');
  expect(
    renderToStaticMarkup(<SessionPlanBadge session={{ ...session, isPlanning: false }} />),
  ).toBe("");
});
