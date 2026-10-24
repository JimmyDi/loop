import { expect, test } from "vitest";

import { restartingResponse } from "./restarting-response";

test("restart responses expose uncached retry guidance without caching chats or replaying writes", async () => {
  const page = restartingResponse(new Request("https://example.test/"));
  expect(page.status).toBe(503);
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(await page.text()).toContain('http-equiv="refresh"');
  const api = restartingResponse(new Request("https://example.test/api/sessions"));
  expect(await api.json()).toEqual({ code: "backend_restarting" });
  expect(
    await restartingResponse(new Request("https://example.test/", { method: "HEAD" })).text(),
  ).toBe("");
});
