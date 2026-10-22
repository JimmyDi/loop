import type { DownloadProgress } from "./cli-download";
import { join } from "node:path";
import { CliInstaller } from "./cli-installer";
import { runCli } from "./cli-process";
import { CliTunnel } from "./cli-tunnel";
import { RemoteAccessError } from "./errors";
import { TunnelStore } from "./tunnel-store";

export type RemoteRuntime = {
  installed(signal: AbortSignal): Promise<boolean>;
  install(signal: AbortSignal, progress: (value: DownloadProgress) => void): Promise<void>;
  uninstall(): Promise<void>;
  pauseDownload(paused: boolean): boolean;
  login(signal: AbortSignal): Promise<void>;
  logout(): Promise<void>;
  start(signal: AbortSignal, failed: () => void): Promise<string>;
  close(): Promise<void>;
};

export const createCliRuntime = (
  directory: string,
  ingressFactory?: ConstructorParameters<typeof CliTunnel>[2],
  tunnelFile = join(directory, "tunnel.json"),
): RemoteRuntime => {
  const installer = new CliInstaller(directory);
  let tunnel: CliTunnel | undefined;
  return {
    installed: (signal) => installer.installed(signal),
    install: (signal, progress) => installer.install(signal, progress),
    uninstall: () => installer.uninstall(),
    pauseDownload: (paused) => installer.pause(paused),
    login: async (signal) => {
      const deadline = AbortSignal.timeout(180_000);
      try {
        await runCli(
          installer.file,
          ["user", "login", "--entra", "--use-browser-auth", "--json"],
          AbortSignal.any([signal, deadline]),
          0,
        );
      } catch {
        signal.throwIfAborted();
        throw new RemoteAccessError(deadline.aborted ? "sign_in_timeout" : "sign_in_failed");
      }
    },
    logout: async () => {
      await runCli(installer.file, ["user", "logout", "--json"], AbortSignal.timeout(30_000));
    },
    start: async (signal, failed) => {
      tunnel = new CliTunnel(installer.file, new TunnelStore(tunnelFile), ingressFactory);
      return tunnel.start(signal, failed);
    },
    close: async () => {
      await tunnel?.close();
      tunnel = undefined;
    },
  };
};
