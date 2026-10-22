import type { RemoteSession } from "../../shared/remote-devices";

let csrf: string | undefined;
let bootstrap: { session: RemoteSession; checkedAt: number } | undefined;

export const setBootstrapSession = (session: RemoteSession): void => {
  bootstrap = { session, checkedAt: Date.now() };
};

export const takeBootstrapSession = () => {
  const value = bootstrap;
  bootstrap = undefined;
  return value;
};

export const isRemoteClient = (): boolean =>
  typeof document !== "undefined" && !!document.querySelector('meta[name="loop-remote"]');

export const setRemoteCsrf = (value?: string): void => {
  csrf = value;
};

export const remoteCsrfHeaders = (method = "GET"): Record<string, string> =>
  isRemoteClient() && csrf && !["GET", "HEAD"].includes(method.toUpperCase())
    ? { "X-Loop-CSRF": csrf }
    : {};

export const checkRemoteSession = (): void => {
  if (isRemoteClient()) window.dispatchEvent(new Event("loop-remote-check"));
};
