import { expect, test } from "vitest";

import { commandPhase } from "./command-phase";

test.each([
  ["install", false, false, "installing"],
  ["install", true, true, "installing"],
  ["uninstall", true, true, "uninstalling"],
  ["login", false, false, "installing"],
  ["login", true, false, "signing-in"],
  ["login", true, true, "signing-in"],
  ["start", false, false, "installing"],
  ["start", true, false, "signing-in"],
  ["start", true, true, "connecting"],
] as const)("%s starts in %s/%s state with phase %s", (command, installed, signedIn, phase) => {
  expect(commandPhase(command, { supported: true, installed, signedIn, phase: "off" })).toBe(phase);
});
