import type {
  RemoteAccessErrorCode,
  RemoteAccessStatus,
  RemoteAccessStep,
} from "../../../shared/remote-access";

const errorSteps: Record<RemoteAccessErrorCode, RemoteAccessStep | undefined> = {
  unsupported_platform: "install",
  cli_install_failed: "install",
  cli_uninstall_failed: "install",
  cli_integrity_failed: "install",
  cli_failed: undefined,
  sign_in_failed: "login",
  sign_in_timeout: "login",
  sign_in_state_failed: "login",
  connection_state_failed: "start",
  tunnel_failed: "start",
};

export const remoteAccessErrorStep = (
  status?: RemoteAccessStatus,
): RemoteAccessStep | undefined => {
  if (status?.supported === false) return "install";
  if (!status?.error || status.error === "cli_install_failed") return;
  return (
    status.errorStep ??
    errorSteps[status.error] ??
    (!status.installed ? "install" : !status.signedIn ? "login" : "start")
  );
};
