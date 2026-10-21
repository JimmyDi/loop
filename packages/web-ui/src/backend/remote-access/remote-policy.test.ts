import { expect, test } from "vitest";

import { allowsRemoteBusiness } from "./remote-policy";

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
