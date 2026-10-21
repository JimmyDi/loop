import type { RemoteAccessStatus } from "../../shared/remote-access";
import type { RemoteRuntime } from "./cli-runtime";
import { updateStepFailures } from "./step-failures";

export const checkInstallation = async (
  runtime: RemoteRuntime,
  status: RemoteAccessStatus,
  signal: AbortSignal,
): Promise<RemoteAccessStatus> => {
  const installed = await runtime.installed(signal);
  signal.throwIfAborted();
  return {
    ...status,
    ...updateStepFailures(status, "install", installed ? "passed" : "failed"),
    installed,
    signedIn: installed && status.signedIn,
  };
};
