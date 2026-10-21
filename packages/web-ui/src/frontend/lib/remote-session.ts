let csrf: string | undefined;

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
