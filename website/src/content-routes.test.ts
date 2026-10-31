import { expect, test } from "vitest";
import releases from "virtual:release-content";

import { contentRoutes, normalizeRoute, resolveContentRoute } from "./content-routes";

test("latest docs resolve to a published snapshot and nested routes retain their slug", () => {
  expect(normalizeRoute("/loop/docs/0.4.0/web/voice/index.html")).toBe("docs/0.4.0/web/voice/");
  expect(resolveContentRoute("docs/latest/").release?.version).toBe(releases[0].version);
  expect(resolveContentRoute("docs/0.4.0/web/voice/").page?.title).toBeTruthy();
  expect(resolveContentRoute("docs/999.0.0/").release).toBeUndefined();
  expect(contentRoutes()).toContain("changelog/0.3.1/");
  expect(contentRoutes()).not.toContain("changelog/Unreleased/");
});
