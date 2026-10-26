import { expect, test } from "vitest";

import { localContext, readContext, writeContext } from "./business-context";

test("the authenticated gateway replaces caller supplied identity before forwarding", () => {
  const headers = new Headers({
    "x-loop-principal": "injected",
    "x-loop-expiry": "9",
    "x-loop-source-origin": "https://untrusted.example",
  });
  writeContext(headers, localContext);
  expect(headers.has("x-loop-expiry")).toBe(false);
  expect(headers.has("x-loop-source-origin")).toBe(false);
  expect(readContext(headers)).toEqual(localContext);
  const local = { ...localContext, origin: "http://localhost:3080" };
  writeContext(headers, local);
  expect(readContext(headers)).toEqual(local);
  const remote = { principal: crypto.randomUUID(), remote: true, expiresAt: Date.now() + 60_000 };
  writeContext(headers, remote);
  expect(readContext(headers)).toEqual(remote);
  headers.set("x-loop-expiry", "1");
  expect(() => readContext(headers)).toThrow("device_unauthorized");
});
