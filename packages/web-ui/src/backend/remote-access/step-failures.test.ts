import { expect, test } from "vitest";

import type { RemoteAccessStatus } from "../../shared/remote-access";
import { completeStep, resetSteps, updateStepFailures } from "./step-failures";

const status: RemoteAccessStatus = {
  supported: true,
  installed: true,
  signedIn: true,
  phase: "connected",
};

test("only previously completed steps fail and recovery clears only that step", () => {
  const incomplete = { ...status, installed: false, signedIn: false, phase: "off" as const };
  for (const step of ["install", "login", "start"] as const) {
    expect(updateStepFailures(incomplete, step, "failed").failedSteps).toBeUndefined();
    expect(updateStepFailures(status, step, "failed").failedSteps).toEqual([step]);
  }
  const failed = { ...status, failedSteps: ["install", "login"] as const };
  const recovered = completeStep({ ...failed, failedSteps: [...failed.failedSteps] }, "install");
  expect(recovered.failedSteps).toEqual(["login"]);
  expect(completeStep(recovered, "login").failedSteps).toBeUndefined();
  expect(resetSteps(recovered)).toMatchObject({
    installed: false,
    signedIn: false,
    phase: "off",
    failedSteps: undefined,
  });
});
