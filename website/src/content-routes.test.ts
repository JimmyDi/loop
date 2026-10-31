import { expect, test } from "vitest";
import releases from "virtual:release-content";

import { contentRoutes, normalizeRoute, resolveContentRoute } from "./content-routes";

test("latest docs resolve to a published snapshot and nested routes retain their slug", () => {
  expect(normalizeRoute("/loop/docs/web/voice/index.html")).toBe("docs/web/voice/");
  expect(resolveContentRoute("docs/").release?.version).toBe(releases[0].version);
  expect(resolveContentRoute("docs/web/voice/").page?.title).toBeTruthy();
  expect(resolveContentRoute("docs/0.3.1/").page).toBeUndefined();
  expect(contentRoutes().filter((route) => route.startsWith("docs/"))).not.toContain("docs/0.3.1/");
  expect(releases.slice(1).every((release) => release.pages.length === 0)).toBe(true);
  expect(contentRoutes()).toContain("changelog/0.3.1/");
  expect(contentRoutes()).not.toContain("changelog/Unreleased/");
});
