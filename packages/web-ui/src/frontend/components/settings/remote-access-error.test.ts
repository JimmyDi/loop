import { expect, test } from "vitest";

import type { RemoteAccessStatus } from "../../../shared/remote-access";
import { remoteAccessErrorStep } from "./remote-access-error";

const status: RemoteAccessStatus = {
  supported: true,
  installed: true,
  signedIn: true,
  phase: "error",
};

test("generic CLI failures use the server's failing step rather than completion flags", () => {
  for (const errorStep of ["install", "login", "start"] as const) {
    expect(remoteAccessErrorStep({ ...status, error: "cli_failed", errorStep })).toBe(errorStep);
  }
});

test("download errors stay hidden and successful states have no issue", () => {
  expect(remoteAccessErrorStep()).toBeUndefined();
  expect(remoteAccessErrorStep({ ...status, phase: "off" })).toBeUndefined();
  expect(
    remoteAccessErrorStep({ ...status, error: "cli_install_failed", errorStep: "install" }),
  ).toBeUndefined();
});
