import type { RemoteAccessCommand, RemoteAccessStatus } from "../../../shared/remote-access";

export const remoteAccessProgress = (
  status: RemoteAccessStatus | undefined,
  requested: RemoteAccessCommand | undefined,
  requestStep: number,
) => {
  const phase = status?.phase;
  const active = !!phase && !["off", "error"].includes(phase);
  const connected = phase === "connected";
  const uninstalling = phase === "uninstalling" || requested === "uninstall";
  const accountActivity =
    phase === "signing-out" || (requested === "logout" && !active)
      ? ("signing-out" as const)
      : phase === "signing-in" || requested === "login"
        ? ("signing-in" as const)
        : undefined;
  const current =
    phase === "installing" || phase === "uninstalling"
      ? 0
      : phase === "signing-in" || phase === "signing-out"
        ? 1
        : 2;
  const busyStep = requested
    ? requested === "logout"
      ? accountActivity
        ? 1
        : current
      : requestStep
    : active && !connected && !status?.download?.paused
      ? current
      : -1;
  const tunnelActivity =
    phase === "stopping" || (connected && (requested === "stop" || requested === "logout"))
      ? ("stopping" as const)
      : phase === "connecting" || (requested === "start" && !active)
        ? ("connecting" as const)
        : undefined;

  return {
    phase,
    active,
    connected,
    canDisconnect: phase === "connected" || phase === "connecting" || phase === "stopping",
    current,
    busyStep,
    accountActivity,
    activities: [
      uninstalling ? "uninstalling" : undefined,
      accountActivity,
      tunnelActivity,
    ] as const,
    installing: phase === "installing" || requested === "install",
  };
};
