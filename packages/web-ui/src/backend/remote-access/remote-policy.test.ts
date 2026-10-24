import { expect, test } from "vitest";

import { assertRemoteOrigin, allowsRemoteBusiness } from "./remote-policy";

test("paired devices can read session images but cannot write them", () => {
  expect(allowsRemoteBusiness("/api/sessions/example/images", "GET")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/example/images", "HEAD")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/example/images", "POST")).toBe(false);
  expect(allowsRemoteBusiness("/api/sessions/example/files", "GET")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/example/files", "HEAD")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/example/files", "POST")).toBe(false);
});

test("remote pairing documents allow cross-site top-level navigation after browser or sign-in handoff", () => {
  const origin = "https://example.test";
  for (const path of ["/", "/index.html", "/remote.html"]) {
    for (const method of ["GET", "HEAD"]) {
      const request = new Request(origin + path, {
        method,
        headers: {
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      });
      expect(() => assertRemoteOrigin(request, origin)).not.toThrow();
    }
  }
});

test("navigation never exempts APIs, writes, foreign origins or embedded requests", () => {
  const origin = "https://example.test";
  const navigation = {
    "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
  };
  for (const path of [
    "/api/remote-session",
    "/api/remote-pairing",
    "/api/workspaces",
    "/api/sessions/example/events",
    "/assets/example.js",
    "/unknown.html",
  ]) {
    const request = new Request(origin + path, { headers: navigation });
    expect(() => assertRemoteOrigin(request, origin)).toThrow("invalid_origin");
  }
  for (const headers of [
    { ...navigation, origin: "https://other.test" },
    { ...navigation, origin: "null" },
    { ...navigation, "sec-fetch-mode": "cors" },
    { ...navigation, "sec-fetch-mode": "no-cors" },
    { ...navigation, "sec-fetch-dest": "iframe" },
    { ...navigation, "sec-fetch-dest": "empty" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    expect(() => assertRemoteOrigin(new Request(origin, { headers }), origin)).toThrow(
      "invalid_origin",
    );
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const request = new Request(origin, { method, headers: { ...navigation, origin } });
    expect(() => assertRemoteOrigin(request, origin)).toThrow("invalid_origin");
  }
});

test("remote routes expose existing chat commands while configuration and unknown endpoints stay closed", () => {
  for (const path of [
    "/api/workspaces",
    "/api/workspaces/events",
    "/api/sessions",
    "/api/models",
    "/api/settings/skills",
    "/api/sessions/example",
    "/api/sessions/example/events",
  ]) {
    expect(allowsRemoteBusiness(path, "GET")).toBe(true);
  }
  expect(allowsRemoteBusiness("/api/sessions", "POST")).toBe(true);
  for (const action of [
    "prompt",
    "queue",
    "resume",
    "abort",
    "flush",
    "compact",
    "title",
    "approvals/example",
  ]) {
    expect(allowsRemoteBusiness("/api/sessions/example/" + action, "POST")).toBe(true);
  }
  for (const action of ["model", "title", "permission", "read", "pin"]) {
    expect(allowsRemoteBusiness("/api/sessions/example/" + action, "PUT")).toBe(true);
  }
  for (const path of [
    "/api/settings",
    "/api/settings/providers",
    "/api/settings/mcp",
    "/api/remote-access",
    "/api/remote-access/pairing",
    "/api/directories/pick",
    "/api/workspaces/example/archive",
    "/api/sessions/example/unknown",
    "/api/settings/skills/install",
  ]) {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"])
      expect(allowsRemoteBusiness(path, method)).toBe(false);
  }
});
