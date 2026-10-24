import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import type { HTMLButtonElement, HTMLElement } from "happy-dom";
import { expect, test, vi } from "vitest";

import { mountRemoteBootstrap } from "./remote-bootstrap";

const setup = async (fragment = "#pair=synthetic-invite") => {
  const window = new Window({ url: "https://example.test/" + fragment });
  window.document.write(await readFile(new URL("../remote.html", import.meta.url), "utf8"));
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const document = window.document;
  return {
    window,
    document,
    form: document.querySelector("form")!,
    input: document.querySelector("input")!,
    status: document.querySelector("[data-status]")!,
    error: document.querySelector<HTMLElement>("p[role=alert]")!,
    retry: document.querySelector<HTMLButtonElement>("button[data-retry]")!,
    close: async (dispose: () => void) => {
      dispose();
      vi.useRealTimers();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    },
  };
};

test("the HTML form is available before authorization; late checks preserve an active pairing", async () => {
  const page = await setup();
  let initial!: (response: Response) => void;
  let approved = false;
  const fetcher = vi.fn((path: string, init?: RequestInit) => {
    if (path === "/api/remote-session") {
      if (!initial)
        return new Promise<Response>((resolve) => {
          initial = resolve;
        });
      return Promise.resolve(Response.json({ mode: "remote", authorized: true }));
    }
    if (init?.method === "POST")
      return Promise.resolve(Response.json({ state: "pending", confirmation: "123456" }));
    return Promise.resolve(
      Response.json({ state: approved ? "approved" : "pending", confirmation: "123456" }),
    );
  });
  globalThis.fetch = fetcher as typeof fetch;
  const loadChat = vi.fn(async () => {});
  expect(page.form.hidden).toBe(false);
  expect(page.input.name).toBe("name");
  vi.useFakeTimers();
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    expect(page.form.hidden).toBe(false);
    expect(page.window.location.hash).toBe("");
    expect(page.window.sessionStorage.getItem("loop.pending-pairing")).toContain(
      "synthetic-invite",
    );
    expect(loadChat).not.toHaveBeenCalled();
    page.input.value = "Example phone";
    page.form.dispatchEvent(new page.window.Event("submit", { cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/remote-pairing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "synthetic-invite", name: "Example phone" }),
      }),
    );
    expect(page.status.textContent).toBe("Waiting for approval on your computer");
    expect(page.window.sessionStorage.getItem("loop.pending-pairing")).toBeNull();
    expect(page.document.querySelector("[data-code]")?.textContent).toBe("123456");
    initial(Response.json({ mode: "remote", authorized: true }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(loadChat).not.toHaveBeenCalled();
    expect(page.form.hidden).toBe(true);
    approved = true;
    await vi.advanceTimersByTimeAsync(1500);
    expect(loadChat).toHaveBeenCalledOnce();
    const calls = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledTimes(calls);
  } finally {
    await page.close(dispose);
  }
});

test("an authorized device can retry a failed chat download without re-pairing", async () => {
  const page = await setup("");
  globalThis.fetch = vi.fn(async () =>
    Response.json({ mode: "remote", authorized: true }),
  ) as typeof fetch;
  const loadChat = vi
    .fn()
    .mockRejectedValueOnce(new Error("Synthetic offline"))
    .mockResolvedValueOnce(undefined);
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    await vi.waitFor(() => expect(page.retry.hidden).toBe(false));
    expect(page.error.textContent).toContain("Cannot confirm");
    page.retry.click();
    await vi.waitFor(() => expect(loadChat).toHaveBeenCalledTimes(2));
    expect(page.form.hidden).toBe(true);
  } finally {
    await page.close(dispose);
  }
});

test("refresh before submission restores the invitation and authorized entry clears it", async () => {
  const page = await setup();
  let authorized = false;
  const fetcher = vi.fn(async (_path: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? { state: "pending", confirmation: "123456" }
        : { mode: "remote", authorized },
    ),
  );
  globalThis.fetch = fetcher as typeof fetch;
  const loadChat = vi.fn(async () => {});
  let dispose = mountRemoteBootstrap(loadChat);
  try {
    dispose();
    expect(page.window.location.hash).toBe("");
    dispose = mountRemoteBootstrap(loadChat);
    expect(page.form.hidden).toBe(false);
    page.input.value = "Example phone";
    page.form.dispatchEvent(new page.window.Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(page.status.textContent).toContain("Waiting"));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/remote-pairing",
      expect.objectContaining({
        body: JSON.stringify({ token: "synthetic-invite", name: "Example phone" }),
      }),
    );
    expect(page.window.sessionStorage.getItem("loop.pending-pairing")).toBeNull();
    dispose();
    page.window.location.hash = "pair=synthetic-unused";
    authorized = true;
    dispose = mountRemoteBootstrap(loadChat);
    await vi.waitFor(() => expect(loadChat).toHaveBeenCalledOnce());
    expect(page.window.sessionStorage.getItem("loop.pending-pairing")).toBeNull();
  } finally {
    await page.close(dispose);
  }
});

test("refresh keeps pairing hidden through slow authorization and chat downloads", async () => {
  const page = await setup("");
  let authorize!: (response: Response) => void;
  let open!: () => void;
  globalThis.fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        authorize = resolve;
      }),
  ) as typeof fetch;
  const loadChat = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        open = resolve;
      }),
  );
  const pairingVisible = () => page.document.documentElement.hasAttribute("data-pairing");
  expect(pairingVisible()).toBe(false);
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    expect(pairingVisible()).toBe(false);
    expect(page.form.hidden).toBe(true);
    expect(page.document.querySelector("[data-loading]")?.textContent).toBe(
      "Checking device access…",
    );
    authorize(Response.json({ mode: "remote", authorized: true }));
    await vi.waitFor(() => expect(loadChat).toHaveBeenCalledOnce());
    expect(pairingVisible()).toBe(false);
    expect(page.form.hidden).toBe(true);
    expect(page.document.querySelector("[data-loading]")?.textContent).toBe("Opening chats…");
    open();
    await Promise.resolve();
    expect(pairingVisible()).toBe(false);
  } finally {
    await page.close(dispose);
  }
});

test("a browser without an invitation or pairing cookie is unpaired, not expired", async () => {
  const page = await setup("");
  const fetcher = vi.fn(async (path: string, _init?: RequestInit) =>
    Response.json(
      path.endsWith("remote-session")
        ? { mode: "remote", authorized: false }
        : { state: "unpaired" },
    ),
  );
  globalThis.fetch = fetcher as typeof fetch;
  const loadChat = vi.fn(async () => {});
  vi.useFakeTimers();
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    expect(page.form.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(page.status.textContent).toBe(
      "This browser is not paired. Scan the current pairing code on your computer.",
    );
    expect(page.form.hidden).toBe(true);
    expect(loadChat).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  } finally {
    await page.close(dispose);
  }
});

test("refresh resumes pending approval without another invitation", async () => {
  const page = await setup("");
  let approved = false;
  globalThis.fetch = vi.fn(async (path: string) =>
    Response.json(
      path.endsWith("remote-session")
        ? { mode: "remote", authorized: approved }
        : { state: approved ? "approved" : "pending", confirmation: "123456" },
    ),
  ) as typeof fetch;
  const loadChat = vi.fn(async () => {});
  vi.useFakeTimers();
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(page.status.textContent).toBe("Waiting for approval on your computer");
    expect(page.document.querySelector("[data-code]")?.textContent).toBe("123456");
    expect(page.form.hidden).toBe(true);
    approved = true;
    await vi.advanceTimersByTimeAsync(1500);
    expect(loadChat).toHaveBeenCalledOnce();
  } finally {
    await page.close(dispose);
  }
});

test.each(["rejected", "expired", "unreachable"])(
  "pairing %s stays closed and shows recovery guidance",
  async (state) => {
    const page = await setup("");
    globalThis.fetch = vi.fn(async (path: string) => {
      if (state === "unreachable") return new Response(null, { status: 503 });
      return Response.json(
        path.endsWith("remote-session") ? { mode: "remote", authorized: false } : { state },
      );
    }) as typeof fetch;
    const loadChat = vi.fn(async () => {});
    const dispose = mountRemoteBootstrap(loadChat);
    try {
      await vi.waitFor(() =>
        expect(
          state === "unreachable"
            ? !page.error.hidden
            : page.status.textContent?.includes(state === "rejected" ? "declined" : "expired"),
        ).toBe(true),
      );
      expect(loadChat).not.toHaveBeenCalled();
      expect(page.form.hidden).toBe(true);
    } finally {
      await page.close(dispose);
    }
  },
);

test("cleanup aborts a slow authorization check and prevents chat mounting", async () => {
  const page = await setup();
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  globalThis.fetch = vi.fn((_path, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as typeof fetch;
  const loadChat = vi.fn(async () => {});
  const dispose = mountRemoteBootstrap(loadChat);
  try {
    dispose();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ mode: "remote", authorized: true }));
    await new Promise((done) => setTimeout(done, 0));
    expect(loadChat).not.toHaveBeenCalled();
  } finally {
    await page.close(dispose);
  }
});
