import { afterEach, expect, test, vi } from "vitest";

vi.mock("./titlebar", () => ({}));

const setup = async (development: boolean) => {
  vi.useFakeTimers();
  vi.stubEnv("DEV", development);
  const button = {
    hidden: true,
    title: "",
    parentElement: null as unknown,
    onclick: undefined as (() => void) | undefined,
    setAttribute: vi.fn(),
    remove: vi.fn(),
  };
  const navigation = {
    append: vi.fn(() => {
      button.parentElement = navigation;
    }),
  };
  const querySelector = vi.fn().mockReturnValue(null);
  vi.stubGlobal("document", {
    body: {},
    querySelector,
    createElement: () => button,
  });
  let mount = () => {};
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mount = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("navigator", { language: "en" });
  const confirm = vi.fn().mockReturnValue(false);
  const alert = vi.fn();
  vi.stubGlobal("window", { confirm, alert });
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ phase: "disabled" }),
  });
  vi.stubGlobal("fetch", fetch);
  await import("./client");
  querySelector.mockReturnValue(navigation);
  mount();
  mount();
  return { button, navigation, fetch, confirm, alert, mount, querySelector };
};

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test.each([true, false])(
  "update visibility follows server state in development=%s",
  async (development) => {
    const { button, navigation, fetch, alert } = await setup(development);
    expect(navigation.append).toHaveBeenCalledOnce();
    expect(button.hidden).toBe(true);
    for (const phase of ["idle", "checking", "latest", "disabled", "error"]) {
      fetch.mockResolvedValue({ ok: true, json: async () => ({ phase }) });
      await vi.advanceTimersByTimeAsync(2000);
      expect(button.hidden).toBe(true);
    }
    fetch.mockRejectedValue(new Error("Connection failed"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.hidden).toBe(true);
    expect(alert).not.toHaveBeenCalled();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ phase: "waiting", version: "1.0.0" }),
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.hidden).toBe(false);
    fetch.mockRejectedValue(new Error("Connection failed"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.hidden).toBe(false);
    expect(button.title).toBe("Update service unavailable");
    fetch.mockResolvedValue({ ok: true, json: async () => ({ phase: "latest" }) });
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.hidden).toBe(true);
  },
);

test("a versioned update error is visible after a page reload", async () => {
  const { button, fetch } = await setup(false);
  fetch.mockResolvedValue({ ok: true, json: async () => ({ phase: "error", version: "1.0.0" }) });
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.hidden).toBe(false);
});

test("ready updates require confirmation before stopping tasks and prevent repeated requests", async () => {
  const { button, fetch, confirm } = await setup(false);
  expect(button.hidden).toBe(true);
  fetch.mockResolvedValue({ ok: true, json: async () => ({ phase: "waiting" }) });
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.hidden).toBe(false);
  expect(button.title).toBe("Stop tasks and update");
  button.onclick?.();
  expect(fetch).not.toHaveBeenCalledWith("/__desktop/stop", { method: "POST" });
  confirm.mockReturnValue(true);
  button.onclick?.();
  button.onclick?.();
  expect(fetch.mock.calls.filter(([url]) => url === "/__desktop/stop")).toHaveLength(1);
  expect(button.title).toBe("Stopping tasks");
});

test("download progress and errors remain available through the icon", async () => {
  const { button, fetch, alert, confirm } = await setup(false);
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ phase: "downloading", version: "1.0.0", progress: 42 }),
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.title).toBe("Downloading update · 1.0.0 · 42%");
  expect(button.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
  button.onclick?.();
  expect(confirm).not.toHaveBeenCalled();
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ phase: "error", message: "Download failed" }),
  });
  await vi.advanceTimersByTimeAsync(2000);
  button.onclick?.();
  expect(alert).toHaveBeenCalledWith("Update failed · Download failed");
});

test("the icon remounts when navigation is recreated", async () => {
  const { mount, querySelector, navigation } = await setup(true);
  const next = { append: vi.fn() };
  querySelector.mockReturnValue(next);
  mount();
  expect(navigation.append).toHaveBeenCalledOnce();
  expect(next.append).toHaveBeenCalledOnce();
});
