import type {
  RemoteAccessErrorCode,
  RemoteAccessStatus,
  RemoteAccessStep,
} from "../../shared/remote-access";

export const stepError = (
  errorStep: RemoteAccessStep,
  error: RemoteAccessErrorCode,
): Pick<RemoteAccessStatus, "phase" | "error" | "errorStep" | "url" | "download"> => ({
  phase: "error",
  error,
  errorStep,
  url: undefined,
  download: undefined,
});

export const updateStepFailures = (
  status: RemoteAccessStatus,
  step: RemoteAccessStep,
  result: "passed" | "failed",
  previous = status,
): Pick<RemoteAccessStatus, "failedSteps"> => {
  const failures = new Set(status.failedSteps);
  const completed = {
    install: previous.installed,
    login: previous.signedIn,
    start: previous.phase === "connected",
  };
  if (result === "passed") failures.delete(step);
  else if (completed[step]) failures.add(step);
  return { failedSteps: failures.size ? [...failures] : undefined };
};

export const completeStep = (
  status: RemoteAccessStatus,
  step: RemoteAccessStep,
): RemoteAccessStatus => ({
  ...status,
  ...updateStepFailures(status, step, "passed"),
  ...(step === "install"
    ? { installed: true, download: undefined }
    : step === "login"
      ? { signedIn: true }
      : { phase: "connected" }),
});

export const resetSteps = (status: RemoteAccessStatus): RemoteAccessStatus => ({
  ...status,
  installed: false,
  signedIn: false,
  phase: "off",
  failedSteps: undefined,
});
