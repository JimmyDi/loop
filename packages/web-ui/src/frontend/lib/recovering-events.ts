type Options = {
  url(): string;
  message(event: MessageEvent): void;
  disconnected(): void;
};

/** Reconnect reads only. Commands are never replayed by this transport. */
export const recoveringEvents = (options: Options) => {
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let offline = window.navigator.onLine === false;
  let hidden = document.visibilityState === "hidden";
  let lastActivity = Date.now();
  let failures = 0;
  const stop = () => {
    clearTimeout(retry);
    retry = undefined;
    source?.close();
    source = undefined;
  };
  const connect = () => {
    if (disposed || offline) return;
    stop();
    lastActivity = Date.now();
    const current = new EventSource(options.url());
    source = current;
    const active = () => !disposed && current === source;
    const activity = () => {
      if (!active()) return;
      lastActivity = Date.now();
      failures = 0;
    };
    current.onmessage = (event) => {
      if (!active()) return;
      activity();
      options.message(event);
    };
    current.addEventListener?.("heartbeat", activity);
    current.onerror = () => {
      if (!active()) return;
      stop();
      options.disconnected();
      if (!offline)
        retry = setTimeout(connect, Math.min(30_000, 1500 * 2 ** Math.min(failures++, 5)));
    };
  };
  const reconnect = () => {
    if (disposed) return;
    stop();
    options.disconnected();
    connect();
  };
  const online = () => {
    offline = false;
    reconnect();
  };
  const lost = () => {
    offline = true;
    stop();
    options.disconnected();
  };
  const visibility = () => {
    const visible = document.visibilityState !== "hidden";
    if (visible && hidden) reconnect();
    hidden = !visible;
  };
  const restored = (event: PageTransitionEvent) => {
    if (event.persisted) reconnect();
  };
  const watchdog = setInterval(() => {
    if (!offline && document.visibilityState !== "hidden" && Date.now() - lastActivity > 45_000)
      reconnect();
  }, 15_000);
  window.addEventListener("online", online);
  window.addEventListener("offline", lost);
  window.addEventListener("pageshow", restored);
  document.addEventListener("visibilitychange", visibility);
  connect();
  if (offline) options.disconnected();
  return {
    reconnect,
    close: () => {
      disposed = true;
      stop();
      clearInterval(watchdog);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", lost);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
};
