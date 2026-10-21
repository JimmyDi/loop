import type { PairingStatus, RemoteSession } from "../../shared/remote-devices";
import { remoteBootstrapView } from "./remote-bootstrap-view";

export const mountRemoteBootstrap = (loadChat: () => Promise<unknown>): (() => void) => {
  const view = remoteBootstrapView(document);
  let token = new URLSearchParams(window.location.hash.slice(1)).get("pair") ?? "";
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let submitted = false;
  let opening = false;
  let revision = 0;
  let retry = () => {};
  const request = async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]),
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Pairing request failed");
    return response.json();
  };
  const open = async () => {
    if (disposed || opening) return;
    opening = true;
    clearTimeout(timer);
    view.error();
    view.status("opening");
    try {
      await loadChat();
      dispose();
    } catch {
      opening = false;
      if (!disposed) {
        view.error("unavailable");
        retry = () => void check();
      }
    }
  };
  const poll = async () => {
    try {
      const pairing = await request<PairingStatus>("remote-pairing");
      if (disposed || opening) return;
      if (pairing.state === "approved") {
        await check();
      } else {
        view.status(
          pairing.state === "pending" ? "waiting" : pairing.state,
          pairing.state === "pending" ? pairing.confirmation : undefined,
        );
        if (pairing.state === "pending") timer = setTimeout(() => void poll(), 1500);
      }
    } catch {
      if (!disposed) {
        view.error("requestFailed");
        retry = () => void poll();
      }
    }
  };
  const check = async () => {
    const started = revision;
    view.error();
    try {
      const session = await request<RemoteSession>("remote-session");
      if (disposed || started !== revision || submitted || opening) return;
      if (session.mode === "remote" && session.authorized) await open();
      else if (!token) await poll();
    } catch {
      if (!disposed && started === revision && !submitted) {
        view.error("unavailable");
        retry = () => void check();
      }
    }
  };
  const submit = (event: Event) => {
    event.preventDefault();
    const name = view.input.value.trim();
    if (!name || !token || submitted || opening) return;
    submitted = true;
    revision++;
    view.busy(true);
    view.error();
    void request<PairingStatus>("remote-pairing", { token, name }).then(
      (pairing) => {
        if (disposed) return;
        token = "";
        submitted = false;
        view.status("waiting", pairing.confirmation);
        timer = setTimeout(() => void poll(), 1500);
      },
      () => {
        submitted = false;
        if (!disposed) {
          view.busy(false);
          view.error("requestFailed");
          retry = () => {
            view.error();
            view.input.focus();
          };
        }
      },
    );
  };
  const retryAction = () => {
    view.error();
    retry();
  };
  const pagehide = (event: PageTransitionEvent) => {
    if (!event.persisted) dispose();
  };
  const dispose = () => {
    disposed = true;
    abort.abort();
    clearTimeout(timer);
    view.form.removeEventListener("submit", submit);
    view.retry.removeEventListener("click", retryAction);
    window.removeEventListener("pagehide", pagehide);
  };
  view.form.addEventListener("submit", submit);
  view.retry.addEventListener("click", retryAction);
  window.addEventListener("pagehide", pagehide);
  view.busy(false);
  if (!token) view.status("checking");
  void check();
  return dispose;
};
