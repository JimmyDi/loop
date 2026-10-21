import type { RemoteAccessPhase, RemoteAccessStatus } from "../../shared/remote-access";

export type SetupCommand = "install" | "uninstall" | "login" | "start";

export const commandPhase = (
  command: SetupCommand,
  status: RemoteAccessStatus,
): RemoteAccessPhase => {
  if (command === "uninstall") return "uninstalling";
  if (command === "install" || !status.installed) return "installing";
  if (command === "login" || !status.signedIn) return "signing-in";
  return "connecting";
};
