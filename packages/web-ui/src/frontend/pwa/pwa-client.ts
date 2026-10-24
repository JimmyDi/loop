export type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaState = {
  enabled: boolean;
  install?: InstallPrompt;
  installed: boolean;
  waiting?: ServiceWorker;
  offline: boolean;
};

let state: PwaState = { enabled: false, installed: false, offline: false };
let registration: ServiceWorkerRegistration | undefined;
let started = false;
let updating = false;
let reloaded = false;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const reloadUpdatedPage = (): void => {
  if (reloaded) return;
  reloaded = true;
  clearTimeout(reloadTimer);
  window.location.reload();
  setTimeout(() => window.location.replace("/"), 250);
};

const publish = (next: Partial<PwaState>): void => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};

export const getPwaState = (): PwaState => state;

export const subscribePwa = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startPwa = (): void => {
  if (started || !import.meta.env.PROD || !window.isSecureContext) return;
  started = true;
  publish({ enabled: true });
  const standalone = window.matchMedia("(display-mode: standalone)");
  const installed = () =>
    publish({
      installed:
        standalone.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      install: undefined,
    });
  installed();
  standalone.addEventListener("change", installed);
  publish({ offline: !navigator.onLine });
  window.addEventListener("offline", () => publish({ offline: true }));
  window.addEventListener("online", () => {
    publish({ offline: false });
    void registration?.update().catch(() => {});
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    publish({ install: event as InstallPrompt });
  });
  window.addEventListener("appinstalled", () => publish({ installed: true, install: undefined }));
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) reloadUpdatedPage();
  });
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((value) => {
      registration = value;
      if (value.waiting) publish({ waiting: value.waiting });
      value.addEventListener("updatefound", () => {
        const worker = value.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller)
            publish({ waiting: value.waiting ?? worker });
        });
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void value.update().catch(() => {});
      });
    })
    .catch(() => {});
};

export const installPwa = async (): Promise<void> => {
  const prompt = state.install;
  if (!prompt) return;
  publish({ install: undefined });
  await prompt.prompt();
  if ((await prompt.userChoice).outcome === "accepted") publish({ installed: true });
};

export const updatePwa = (): void => {
  if (!state.waiting || updating) return;
  updating = true;
  reloadTimer = setTimeout(reloadUpdatedPage, 2_000);
  try {
    state.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  } catch {
    reloadUpdatedPage();
  }
};
