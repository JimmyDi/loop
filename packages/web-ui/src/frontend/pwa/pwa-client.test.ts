import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("production install, waiting updates and explicit reload lifecycle", async () => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  const events = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const worker = { postMessage: vi.fn() };
  const registration = Object.assign(new EventTarget(), {
    waiting: worker,
    update: vi.fn(async () => {}),
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn(async () => registration),
  });
  const reload = vi.fn();
  vi.stubGlobal(
    "window",
    Object.assign(events, {
      isSecureContext: true,
      location: { reload, replace: vi.fn() },
      matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    }),
  );
  vi.stubGlobal("navigator", { onLine: true, serviceWorker });
  vi.stubGlobal("document", document);
  const client = await import("./pwa-client");
  const listener = vi.fn();
  const unsubscribe = client.subscribePwa(listener);
  client.startPwa();
  client.startPwa();
  await vi.waitFor(() => expect(client.getPwaState().waiting).toBe(worker));
  expect(serviceWorker.register).toHaveBeenCalledExactlyOnceWith("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  expect(reload).not.toHaveBeenCalled();
  const prompt = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  events.dispatchEvent(prompt);
  expect(prompt.defaultPrevented).toBe(true);
  await client.installPwa();
  expect(prompt.prompt).toHaveBeenCalledTimes(1);
  expect(client.getPwaState().installed).toBe(true);
  events.dispatchEvent(new Event("offline"));
  expect(client.getPwaState().offline).toBe(true);
  events.dispatchEvent(new Event("online"));
  expect(client.getPwaState().offline).toBe(false);
  expect(registration.update).toHaveBeenCalledTimes(1);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(registration.update).toHaveBeenCalledTimes(2);
  client.updatePwa();
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "ACTIVATE_UPDATE" });
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  expect(reload).toHaveBeenCalledTimes(1);
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(window.location.replace).toHaveBeenCalledExactlyOnceWith("/");
  expect(listener).toHaveBeenCalled();
  unsubscribe();
});

test("development does not register a worker or advertise installation", async () => {
  vi.stubEnv("PROD", false);
  const client = await import("./pwa-client");
  client.startPwa();
  expect(client.getPwaState().enabled).toBe(false);
});

test("new worker waits for explicit action without automatically reloading", async () => {
  vi.stubEnv("PROD", true);
  const worker = Object.assign(new EventTarget(), { state: "installing", postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {
    installing: worker,
    waiting: null,
    update: vi.fn(async () => {}),
  });
  const container = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn(async () => registration),
  });
  const window = Object.assign(new EventTarget(), {
    isSecureContext: true,
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    location: { reload: vi.fn() },
  });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("navigator", { serviceWorker: container, onLine: true });
  const client = await import("./pwa-client");
  client.startPwa();
  await vi.waitFor(() => expect(container.register).toHaveBeenCalled());
  await Promise.resolve();
  registration.dispatchEvent(new Event("updatefound"));
  worker.state = "installed";
  worker.dispatchEvent(new Event("statechange"));
  expect(client.getPwaState().waiting).toBe(worker);
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(window.location.reload).not.toHaveBeenCalled();
});

test("insecure contexts do not register a worker", async () => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("window", { isSecureContext: false });
  const client = await import("./pwa-client");
  client.startPwa();
  expect(client.getPwaState().enabled).toBe(false);
});

test.each(["unresponsive", "throws"])(
  "explicit update reloads even when worker activation %s",
  async (behavior) => {
    vi.useFakeTimers();
    vi.stubEnv("PROD", true);
    const worker = {
      postMessage: vi.fn(() => {
        if (behavior === "throws") throw new Error("Worker is redundant");
      }),
    };
    const container = Object.assign(new EventTarget(), {
      register: vi.fn(async () => Object.assign(new EventTarget(), { waiting: worker })),
    });
    const location = { reload: vi.fn(), replace: vi.fn() };
    vi.stubGlobal(
      "window",
      Object.assign(new EventTarget(), {
        isSecureContext: true,
        location,
        matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
      }),
    );
    vi.stubGlobal("navigator", { onLine: true, serviceWorker: container });
    vi.stubGlobal("document", new EventTarget());
    const client = await import("./pwa-client");
    client.startPwa();
    await Promise.resolve();
    client.updatePwa();
    client.updatePwa();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_250);
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledExactlyOnceWith("/");
    container.dispatchEvent(new Event("controllerchange"));
    expect(location.reload).toHaveBeenCalledTimes(1);
  },
);
