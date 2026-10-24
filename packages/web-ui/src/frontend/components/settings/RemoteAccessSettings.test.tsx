import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { RemoteAccessStatus } from "../../../shared/remote-access";
import "../../i18n/setup";
import { RemoteAccessSettings } from "./RemoteAccessSettings";

test("unsupported platforms show three incomplete steps and disable all setup actions", async () => {
  const client = new QueryClient();
  client.setQueryData(["remote-access"], {
    supported: false,
    installed: false,
    signedIn: false,
    phase: "off",
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <RemoteAccessSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain('aria-label="Remote access setup"');
  expect(html.match(/aria-label="Not completed"/g)).toHaveLength(3);
  for (const label of ["Install Dev Tunnels CLI", "Sign in", "Connect Tunnel"]) {
    expect(html).toMatch(new RegExp('<button[^>]*aria-label="' + label + '"[^>]*disabled'));
    expect(html).toContain('title="' + label + '"');
  }
  expect(html).toContain("Automatic installation is unavailable");
  expect(html).not.toContain("Connect a private Microsoft Dev Tunnel");
  expect(html).not.toContain("cannot access chats, files or agent actions");
  expect(html).not.toContain("no application IDs or terminal commands are needed");
  expect(html).not.toContain("Privacy Statement");
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = html;
  expect(document.querySelector('[role="alert"]')?.closest("li")).toBe(
    document.querySelectorAll("li")[0],
  );
  expect(document.querySelector('[role="alert"]')?.getAttribute("data-tone")).toBe("warning");
  expect(document.querySelector('[role="alert"]')?.previousElementSibling?.tagName).toBe("H4");
  expect(
    document.querySelector('[role="alert"]')?.closest(".remote-access-step-title"),
  ).toBeTruthy();
  client.clear();
  await window.happyDOM.close();
});

test.each([
  ["cli_integrity_failed", 0, undefined],
  ["cli_uninstall_failed", 0, undefined],
  ["sign_in_failed", 1, undefined],
  ["sign_in_timeout", 1, undefined],
  ["sign_in_state_failed", 1, undefined],
  ["connection_state_failed", 2, undefined],
  ["tunnel_failed", 2, undefined],
  ["cli_failed", 0, "install"],
  ["cli_failed", 1, "login"],
  ["cli_failed", 2, "start"],
] as const)(
  "%s displays its icon and message only inside step %s",
  async (error, index, errorStep) => {
    const window = new Window();
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    client.setQueryData(["remote-access"], {
      supported: true,
      installed: true,
      signedIn: true,
      phase: "error",
      error,
      errorStep,
    });
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <RemoteAccessSettings />
        </QueryClientProvider>,
      );
      const alerts = window.document.querySelectorAll('[role="alert"]');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.closest("li")).toBe(window.document.querySelectorAll("li")[index]);
      expect(alerts[0]?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
      expect(alerts[0]?.textContent).not.toContain("remote.errors.");
      expect(alerts[0]?.getAttribute("data-tone")).toBe("error");
      expect(alerts[0]?.previousElementSibling?.tagName).toBe("H4");
      expect(alerts[0]?.closest(".remote-access-step-title")).toBeTruthy();
      expect(alerts[0]?.closest(".remote-access-step-detail")).toBeNull();
    } finally {
      client.clear();
      await window.happyDOM.close();
    }
  },
);

test.each(["install", "login", "start"] as const)(
  "server-reported %s failure replaces completion with a cross",
  (step) => {
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    client.setQueryData(["remote-access"], {
      supported: true,
      installed: true,
      signedIn: true,
      phase: "connected",
      failedSteps: [step],
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
    expect(html.match(/aria-label="Check failed"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Completed"/g)).toHaveLength(2);
    expect(html).toContain('data-state="failed"');
    client.clear();
  },
);

test("steps unlock in order, complete from server state and reset on stop and sign-out", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let status: RemoteAccessStatus = {
    supported: true,
    installed: false,
    signedIn: false,
    phase: "off",
  };
  client.setQueryData(["remote-access"], status);
  const actions: string[] = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    if (init?.method === "POST") {
      const { action } = JSON.parse(init.body as string);
      actions.push(action);
      if (action === "install")
        status = {
          ...status,
          phase: "installing",
          download: { received: 4, total: 4, stage: "verifying", paused: false },
        };
      if (action === "login") status = { ...status, signedIn: true };
      if (action === "start")
        status = { ...status, phase: "connected", url: "https://example.com" };
      if (action === "stop") status = { ...status, phase: "off", url: undefined };
      if (action === "logout") status = { ...status, signedIn: false };
    }
    return Response.json(status);
  }) as typeof fetch;
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
    for (const name of ["Install Dev Tunnels CLI", "Sign in", "Connect Tunnel"]) {
      const button = view.getByRole("button", { name });
      expect(button.title).toBe(name);
      expect(button.parentElement?.title).toBe(name);
      expect(button.textContent).toBe("");
      expect(button.querySelector("svg")).toBeTruthy();
      expect(button.closest(".remote-access-step-title")?.querySelector("h4")?.textContent).toBe(
        name,
      );
    }
    const disabled = (name: string) =>
      (view.getByRole("button", { name }) as HTMLButtonElement).disabled;
    await vi.waitFor(() => expect(view.queryAllByRole("img", { name: "Loading" })).toHaveLength(0));
    expect(view.queryByRole("progressbar")).toBeNull();
    expect(disabled("Sign in")).toBe(true);
    expect(disabled("Connect Tunnel")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Sign in" }));
    fireEvent.click(view.getByRole("button", { name: "Connect Tunnel" }).parentElement!);
    expect(actions).toEqual([]);
    fireEvent.click(view.getByRole("button", { name: "Install Dev Tunnels CLI" }));
    await vi.waitFor(() =>
      expect(view.getByRole("status").textContent).toBe("Verifying and installing…"),
    );
    expect(view.getAllByRole("listitem")).toHaveLength(3);
    expect(view.queryByRole("button", { name: "Pause download" })).toBeNull();
    expect(view.queryByRole("img", { name: "Completed" })).toBeNull();
    expect(view.getByRole("img", { name: "Loading" }).closest("li")).toBe(
      view.getAllByRole("listitem")[0],
    );
    expect(disabled("Sign in")).toBe(true);
    status = { ...status, installed: true, phase: "off", download: undefined };
    await client.refetchQueries({ queryKey: ["remote-access"] });
    await vi.waitFor(() => expect(disabled("Sign in")).toBe(false));
    expect(disabled("Uninstall Dev Tunnels CLI")).toBe(false);
    expect(view.getByRole("heading", { name: "Uninstall Dev Tunnels CLI" }).title).toBe(
      "Uninstall Dev Tunnels CLI",
    );
    expect(view.queryByRole("heading", { name: "Install Dev Tunnels CLI" })).toBeNull();
    expect(view.queryByRole("progressbar")).toBeNull();
    expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(1);
    expect(view.queryByRole("button", { name: "Install Dev Tunnels CLI" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Sign in" }));
    await vi.waitFor(() => expect(disabled("Connect Tunnel")).toBe(false));
    expect(view.getByRole("heading", { name: "Sign out" }).title).toBe("Sign out");
    expect(view.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(view.getByRole("button", { name: "Sign out" }).title).toBe("Sign out");
    expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Connect Tunnel" }));
    await vi.waitFor(() => expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(3));
    expect(disabled("Uninstall Dev Tunnels CLI")).toBe(true);
    expect(view.queryByRole("link", { name: "https://example.com" })).toBeNull();
    expect(view.container.textContent).not.toContain("https://example.com");
    expect(view.queryByText("Tunnel connected")).toBeNull();
    expect(view.queryByRole("status")).toBeNull();
    expect(view.getByRole("heading", { name: "Disconnect Tunnel" }).title).toBe(
      "Disconnect Tunnel",
    );
    expect(view.queryByRole("button", { name: "Stop / cancel" })).toBeNull();
    expect(disabled("Sign out")).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Disconnect Tunnel" }));
    await vi.waitFor(() => expect(disabled("Sign out")).toBe(false));
    expect(view.queryByRole("link")).toBeNull();
    expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(1));
    await vi.waitFor(() => expect(view.queryByRole("img", { name: "Loading" })).toBeNull());
    expect(disabled("Sign in")).toBe(false);
    expect(view.getByRole("heading", { name: "Sign in" }).title).toBe("Sign in");
    expect(disabled("Connect Tunnel")).toBe(true);
    expect(actions).toEqual(["install", "login", "start", "stop", "logout"]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each([
  ["Install Dev Tunnels CLI", "install", "installing", 0, "Downloading: 1.0 / 2.0 MB"],
  [
    "Sign in",
    "login",
    "signing-in",
    1,
    "Signing in… Complete any system credential prompt, then browser sign-in.",
  ],
  ["Connect Tunnel", "start", "connecting", 2, "Connecting…"],
] as const)(
  "%s shows progress in its step and connection supports cancellation",
  async (label, action, waiting, index, message) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const installed = index > 0;
    const signedIn = index > 1;
    client.setQueryData(["remote-access"], { supported: true, installed, signedIn, phase: "off" });
    const requests: unknown[] = [];
    let phase = "off";
    globalThis.fetch = vi.fn(async (_url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        requests.push(body);
        phase = body.action === action ? waiting : "off";
      }
      return Response.json({
        supported: true,
        installed,
        signedIn,
        phase,
        ...(phase === "installing" ? { download: { received: 1048576, total: 2097152 } } : {}),
      });
    }) as typeof fetch;
    const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemoteAccessSettings />
        </QueryClientProvider>,
      );
      await vi.waitFor(() =>
        expect(view.queryAllByRole("img", { name: "Loading" })).toHaveLength(0),
      );
      fireEvent.click(view.getByRole("button", { name: label }));
      if (index === 2) expect(view.getByRole("progressbar", { name: label })).toBeTruthy();
      await vi.waitFor(() => expect(view.getByRole("status").textContent).toBe(message));
      const marker = view.getByRole("img", { name: "Loading" });
      expect(marker.closest("li")).toBe(view.getAllByRole("listitem")[index]);
      expect(marker.querySelector("svg")).toBeNull();
      expect(view.getByRole("status").closest("li")).toBe(view.getAllByRole("listitem")[index]);
      if (index === 0) {
        const bar = view.getByRole("progressbar", { name: "Install Dev Tunnels CLI" });
        expect(bar.getAttribute("aria-valuenow")).toBe("50");
        expect(bar.closest("li")).toBe(view.getAllByRole("listitem")[0]);
        const cancel = view.getByRole("button", { name: "Stop and delete download" });
        expect(cancel.parentElement?.getAttribute("data-action")).toBe("stop");
        expect(cancel.closest(".remote-cli-progress")).toBe(bar.parentElement);
        const title = cancel.closest(".remote-access-step-title")!;
        expect(title.querySelector("h4")?.textContent).toBe("Install Dev Tunnels CLI");
        expect(title.querySelector("h4")?.nextElementSibling).toBe(bar.parentElement);
        expect(title.querySelector(".remote-cli-progress-percent")?.textContent).toBe("50%");
        expect(bar.closest(".remote-access-step-detail")).toBeNull();
      } else {
        const bar = view.getByRole("progressbar", { name: label });
        expect(bar.closest(".remote-access-step-title")).toBeTruthy();
        expect(
          bar.closest(".remote-access-step-title")?.querySelector("h4")?.nextElementSibling,
        ).toBe(bar.parentElement);
        expect(bar.closest(".remote-access-step-detail")).toBeNull();
        expect(bar.getAttribute("aria-valuenow")).toBeNull();
        expect(bar.querySelector(".remote-cli-progress-fill")?.getAttribute("style")).toContain(
          "100%",
        );
        expect(view.getByRole("status").className).toBe("sr-only");
        expect(bar.parentElement?.querySelector(".remote-cli-progress-percent")).toBeNull();
      }
      expect(
        (view.getByRole("button", { name: "Connect Tunnel" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      if (index !== 0) {
        expect(view.queryByRole("button", { name: "Stop / cancel" })).toBeNull();
        expect(view.queryByRole("button", { name: "Stop and delete download" })).toBeNull();
        if (index === 2) {
          const tunnel = view.getAllByRole("listitem")[2]!;
          await vi.waitFor(() => {
            expect(tunnel.querySelectorAll("button")).toHaveLength(2);
            expect(
              (view.getByRole("button", { name: "Disconnect Tunnel" }) as HTMLButtonElement)
                .disabled,
            ).toBe(false);
          });
          expect(tunnel.querySelector("path")?.getAttribute("d")).not.toBe("M6 6h12v12H6Z");
        }
        await act(async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        });
        if (index === 2) fireEvent.click(view.getByRole("button", { name: "Disconnect Tunnel" }));
        else {
          phase = "off";
          await client.refetchQueries({ queryKey: ["remote-access"] });
        }
      } else {
        fireEvent.click(
          view.getByRole("button", {
            name: "Stop and delete download",
          }),
        );
      }
      await vi.waitFor(() => expect(view.queryByRole("status")).toBeNull());
      expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
      expect(view.queryByRole("progressbar")).toBeNull();
      expect(requests).toEqual(index !== 1 ? [{ action }, { action: "stop" }] : [{ action }]);
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("install shows indeterminate progress immediately and clears it when the request fails", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const status = { supported: true, installed: false, signedIn: false, phase: "off" };
  client.setQueryData(["remote-access"], status);
  let fail: (error: Error) => void = () => {};
  globalThis.fetch = vi.fn(async (_url, init) => {
    if (init?.method === "POST")
      return await new Promise<Response>((_resolve, reject) => {
        fail = reject;
      });
    return Response.json(status);
  }) as typeof fetch;
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(view.queryAllByRole("img", { name: "Loading" })).toHaveLength(0));
    fireEvent.click(view.getByRole("button", { name: "Install Dev Tunnels CLI" }));
    expect(view.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    expect(view.getByRole("status").textContent).toBe("Installing CLI…");
    await vi.waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/remote-access",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    fail(new Error("Synthetic network failure"));
    await vi.waitFor(() => expect(view.queryByRole("progressbar")).toBeNull());
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    expect(view.getByRole("alert").textContent).toContain("The operation could not be confirmed");
    expect(view.getByRole("alert").closest("li")).toBe(view.getAllByRole("listitem")[0]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("entry checks hide cached checks, restore current state and repeat after reentry", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["remote-access"], {
    supported: true,
    installed: true,
    signedIn: true,
    phase: "connected",
  });
  let finish = (_response: Response) => {};
  let fail = (_error: Error) => {};
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  );
  globalThis.fetch = fetcher as typeof fetch;
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const renderSettings = () =>
    render(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
  try {
    let view = renderSettings();
    expect(view.getAllByRole("img", { name: "Loading" })).toHaveLength(3);
    expect(view.queryByRole("img", { name: "Completed" })).toBeNull();
    expect(view.container.querySelector(".remote-access-marker svg")).toBeNull();
    finish(Response.json({ supported: true, installed: true, signedIn: false, phase: "off" }));
    await vi.waitFor(() => expect(view.queryByRole("img", { name: "Loading" })).toBeNull());
    expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(1);
    expect(view.getAllByRole("img", { name: "Not completed" })).toHaveLength(2);
    view.unmount();
    view = renderSettings();
    expect(view.getAllByRole("img", { name: "Loading" })).toHaveLength(3);
    expect(fetcher.mock.calls).toHaveLength(2);
    fail(new Error("Synthetic status error"));
    await vi.waitFor(() => expect(view.getByRole("button", { name: "Retry" })).toBeTruthy());
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    expect(view.getAllByRole("img", { name: "Check failed" })).toHaveLength(1);
    expect(view.queryByRole("img", { name: "Completed" })).toBeNull();
    expect((view.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(view.getByRole("button", { name: "Retry" }));
    await vi.waitFor(() => expect(view.getAllByRole("img", { name: "Loading" })).toHaveLength(3));
    expect(view.queryByRole("img", { name: "Check failed" })).toBeNull();
    finish(Response.json({ supported: true, installed: true, signedIn: true, phase: "off" }));
    await vi.waitFor(() => expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(2));
    expect(view.queryByRole("img", { name: "Check failed" })).toBeNull();
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    for (const call of fetcher.mock.calls as unknown[][])
      expect(call[0]).toBe("/api/remote-access?refresh=1");
    const polling = client.refetchQueries({ queryKey: ["remote-access"] });
    await vi.waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith("/api/remote-access", expect.anything()),
    );
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    finish(Response.json({ supported: true, installed: true, signedIn: true, phase: "connected" }));
    await polling;
    await vi.waitFor(() => expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(3));
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["stop", "logout"] as const)(
  "%s shows tunnel progress until shutdown completes",
  async (action) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    const client = new QueryClient();
    let status: RemoteAccessStatus = {
      supported: true,
      installed: true,
      signedIn: true,
      phase: "connected",
      url: "https://example.com",
    };
    let finish = (_response: Response) => {};
    globalThis.fetch = vi.fn(async (_url, init) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Response.json(status),
    ) as typeof fetch;
    const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemoteAccessSettings />
        </QueryClientProvider>,
      );
      await vi.waitFor(() =>
        expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(3),
      );
      const steps = view.getAllByRole("listitem");
      const expectLoading = (index: number) => {
        const marker = view.getByRole("img", { name: "Loading" });
        expect(marker.closest("li")).toBe(steps[index]);
        expect(marker.querySelector("svg")).toBeNull();
        expect(steps[index]?.getAttribute("data-complete")).toBe("false");
      };
      const expectAccountUnchanged = () => {
        expectLoading(2);
        expect(view.getByRole("heading", { name: "Sign out" }).title).toBe("Sign out");
        expect(steps[1]?.querySelector('[aria-label="Completed"]')).toBeTruthy();
        expect(view.queryByRole("button", { name: "Sign in" })).toBeNull();
        const bar = view.getByRole("progressbar", { name: "Disconnect Tunnel" });
        expect(bar.closest("li")).toBe(steps[2]);
        expect(
          bar.closest(".remote-access-step-title")?.querySelector("h4")?.nextElementSibling,
        ).toBe(bar.parentElement);
        expect(view.getByRole("status").className).toBe("sr-only");
      };
      fireEvent.click(
        view.getByRole("button", { name: action === "stop" ? "Disconnect Tunnel" : "Sign out" }),
      );
      expectAccountUnchanged();
      await vi.waitFor(() =>
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/remote-access",
          expect.objectContaining({ method: "POST", body: JSON.stringify({ action }) }),
        ),
      );
      status = { ...status, phase: "stopping", url: undefined };
      await act(async () => {
        finish(Response.json(status));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(view.container.querySelector(".remote-access-step-detail [role=status]")).toBeNull();
      expectAccountUnchanged();
      expect(steps[2]?.querySelectorAll("button")).toHaveLength(1);
      expect(view.queryByRole("button", { name: "Stop / cancel" })).toBeNull();
      expect(
        (view.getByRole("button", { name: "Disconnect Tunnel" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(view.queryByRole("link")).toBeNull();
      if (action === "stop") {
        status = { ...status, phase: "off" };
        await act(async () => {
          await client.refetchQueries({ queryKey: ["remote-access"] });
        });
        await vi.waitFor(() => expect(view.queryByRole("progressbar")).toBeNull());
        expect(view.queryByRole("status")).toBeNull();
        expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
        expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(2);
        expect(view.getByRole("button", { name: "Connect Tunnel" })).toBeTruthy();
        return;
      }
      status = { ...status, phase: "signing-out", signedIn: false };
      await act(async () => {
        await client.refetchQueries({ queryKey: ["remote-access"] });
      });
      await vi.waitFor(() => expectLoading(1));
      expect(steps[2]?.querySelector('[aria-label="Not completed"]')).toBeTruthy();
      expect(view.getByRole("progressbar", { name: "Sign out" }).closest("li")).toBe(steps[1]);
      expect(view.getByRole("status").textContent).toBe("Signing out…");
      expect(view.getByRole("heading", { name: "Sign out" }).title).toBe("Sign out");
      expect(view.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect((view.getByRole("button", { name: "Sign out" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      status = { ...status, phase: "off" };
      await act(async () => {
        await client.refetchQueries({ queryKey: ["remote-access"] });
      });
      await vi.waitFor(() => expect(view.queryByRole("img", { name: "Loading" })).toBeNull());
      expect(view.queryByRole("progressbar")).toBeNull();
      expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(1);
      expect((view.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test.each(["success", "account failure", "request failure"] as const)(
  "disconnected sign-out shows account progress immediately until %s",
  async (outcome) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    const client = new QueryClient();
    let status: RemoteAccessStatus = {
      supported: true,
      installed: true,
      signedIn: true,
      phase: "off",
    };
    let finish = (_response: Response) => {};
    const fetcher = vi.fn(async (_url, init) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Response.json(status),
    );
    globalThis.fetch = fetcher as typeof fetch;
    const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemoteAccessSettings />
        </QueryClientProvider>,
      );
      await vi.waitFor(() =>
        expect(view.getAllByRole("img", { name: "Completed" })).toHaveLength(2),
      );
      const steps = view.getAllByRole("listitem");
      const expectAccountProgress = () => {
        expect(view.getByRole("progressbar", { name: "Sign out" }).closest("li")).toBe(steps[1]);
        expect(view.getByRole("img", { name: "Loading" }).closest("li")).toBe(steps[1]);
        expect(view.getAllByRole("progressbar")).toHaveLength(1);
        expect(view.getByRole("status").className).toBe("sr-only");
        expect(view.getByRole("status").textContent).toBe("Signing out…");
        expect((view.getByRole("button", { name: "Sign out" }) as HTMLButtonElement).disabled).toBe(
          true,
        );
      };
      fireEvent.click(view.getByRole("button", { name: "Sign out" }));
      expectAccountProgress();
      await vi.waitFor(() =>
        expect(fetcher).toHaveBeenCalledWith(
          "/api/remote-access",
          expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "logout" }) }),
        ),
      );
      if (outcome !== "request failure") {
        status = { ...status, phase: "signing-out", signedIn: false };
      }
      await act(async () => {
        finish(
          outcome === "request failure"
            ? new Response(null, { status: 503 })
            : Response.json(status),
        );
      });
      if (outcome === "request failure") {
        await vi.waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
      } else {
        await vi.waitFor(() =>
          expect(view.queryByRole("img", { name: "Completed" })?.closest("li")).toBe(steps[0]),
        );
        expectAccountProgress();
        status =
          outcome === "success"
            ? { ...status, phase: "off" }
            : { ...status, phase: "error", error: "cli_failed", errorStep: "login" };
        await act(async () => {
          await client.refetchQueries({ queryKey: ["remote-access"] });
        });
      }
      await vi.waitFor(() => expect(view.queryByRole("progressbar")).toBeNull());
      expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
      if (outcome === "success") {
        expect(view.queryByRole("alert")).toBeNull();
        expect((view.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
          false,
        );
      } else {
        expect(view.getByRole("alert").closest("li")).toBe(steps[1]);
      }
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("paused download survives reentry and resumes or stops through server commands", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let status: RemoteAccessStatus = {
    supported: true,
    installed: false,
    signedIn: false,
    phase: "installing",
    download: { received: 1, total: 4, paused: false },
  };
  const actions: string[] = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    if (init?.method === "POST") {
      const { action } = JSON.parse(init.body as string);
      actions.push(action);
      status =
        action === "stop"
          ? { ...status, phase: "off", download: undefined }
          : { ...status, download: { received: 1, total: 4, paused: action === "pause" } };
    }
    return Response.json(status);
  }) as typeof fetch;
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const renderSettings = () =>
    render(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
  try {
    let view = renderSettings();
    await vi.waitFor(() =>
      expect(
        (view.getByRole("button", { name: "Pause download" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(view.getByRole("button", { name: "Pause download" }));
    await vi.waitFor(() =>
      expect(
        (view.getByRole("button", { name: "Resume download" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(view.getByRole("status").textContent).toBe("Download paused");
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    view.unmount();
    view = renderSettings();
    await vi.waitFor(() =>
      expect(
        (view.getByRole("button", { name: "Resume download" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(view.getByRole("button", { name: "Resume download" }));
    await vi.waitFor(() =>
      expect(
        (view.getByRole("button", { name: "Pause download" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(view.getByRole("button", { name: "Stop and delete download" }));
    await vi.waitFor(() => expect(view.queryByRole("progressbar")).toBeNull());
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    expect(actions).toEqual(["pause", "resume", "stop"]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("rejected sign-in clears loading and subsequent status checks do not retry login", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let status: RemoteAccessStatus = {
    supported: true,
    installed: true,
    signedIn: false,
    phase: "off",
  };
  const actions: string[] = [];
  let fail = () => {};
  globalThis.fetch = vi.fn(async (_url, init) => {
    if (init?.method === "POST") {
      actions.push(JSON.parse(init.body as string).action);
      return await new Promise<Response>((resolve) => {
        fail = () => {
          status = { ...status, phase: "error", error: "sign_in_failed" };
          resolve(Response.json(status));
        };
      });
    }
    return Response.json(status);
  }) as typeof fetch;
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessSettings />
      </QueryClientProvider>,
    );
    await vi.waitFor(() =>
      expect((view.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(view.getByRole("button", { name: "Sign in" }));
    expect(view.getByRole("img", { name: "Loading" })).toBeTruthy();
    await vi.waitFor(() => expect(actions).toEqual(["login"]));
    fail();
    await vi.waitFor(() => expect(view.queryByRole("img", { name: "Loading" })).toBeNull());
    expect(view.getByRole("alert").textContent).toContain("Microsoft sign-in did not complete");
    expect(view.queryByRole("progressbar")).toBeNull();
    expect(view.getByRole("alert").closest("li")).toBe(view.getAllByRole("listitem")[1]);
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-access"] });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(view.queryByRole("img", { name: "Loading" })).toBeNull();
    expect(actions).toEqual(["login"]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["success", "uninstall failure", "request failure"] as const)(
  "uninstall shows progress immediately until %s",
  async (outcome) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    const client = new QueryClient();
    let status: RemoteAccessStatus = {
      supported: true,
      installed: true,
      signedIn: true,
      phase: "off",
    };
    let finish = (_response: Response) => {};
    const actions: string[] = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      if (init?.method === "POST") {
        actions.push(JSON.parse(init.body as string).action);
        return await new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return Response.json(status);
    }) as typeof fetch;
    const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemoteAccessSettings />
        </QueryClientProvider>,
      );
      const name = "Uninstall Dev Tunnels CLI";
      await vi.waitFor(() =>
        expect((view.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false),
      );
      const button = view.getByRole("button", { name });
      expect(button.title).toBe(name);
      expect(button.parentElement?.title).toBe(name);
      expect(button.closest("li")).toBe(view.getAllByRole("listitem")[0]);
      expect(view.getByRole("heading", { name }).title).toBe(name);
      const expectUninstallProgress = () => {
        const bar = view.getByRole("progressbar", { name });
        expect(bar.closest("li")).toBe(view.getAllByRole("listitem")[0]);
        expect(
          bar.closest(".remote-access-step-title")?.querySelector("h4")?.nextElementSibling,
        ).toBe(bar.parentElement);
        expect(view.getAllByRole("progressbar")).toHaveLength(1);
        expect(view.getByRole("status").className).toBe("sr-only");
        expect(view.getByRole("status").textContent).toBe("Uninstalling CLI…");
        expect(view.container.querySelector(".remote-access-step-detail [role=status]")).toBeNull();
        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect(view.getByRole("img", { name: "Loading" }).closest("li")).toBe(
          view.getAllByRole("listitem")[0],
        );
        expect(view.queryByRole("button", { name: "Stop / cancel" })).toBeNull();
      };
      fireEvent.click(button);
      expect(view.getByRole("heading", { name }).title).toBe(name);
      expectUninstallProgress();
      await vi.waitFor(() => expect(actions).toEqual(["uninstall"]));
      if (outcome === "request failure") {
        await act(async () => finish(new Response(null, { status: 503 })));
        await vi.waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
      } else {
        status = { ...status, phase: "uninstalling", signedIn: false };
        await act(async () => finish(Response.json(status)));
        await vi.waitFor(() =>
          expect(view.queryByRole("heading", { name: "Sign out" })).toBeNull(),
        );
        expectUninstallProgress();
        status =
          outcome === "success"
            ? { ...status, phase: "off", installed: false }
            : { ...status, phase: "error", error: "cli_uninstall_failed", errorStep: "install" };
        await act(async () => {
          await client.refetchQueries({ queryKey: ["remote-access"] });
        });
      }
      await vi.waitFor(() => expect(view.queryByRole("img", { name: "Loading" })).toBeNull());
      expect(view.queryByRole("progressbar")).toBeNull();
      if (outcome !== "success") {
        expect(view.getByRole("alert").closest("li")).toBe(view.getAllByRole("listitem")[0]);
        expect((view.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
        return;
      }
      expect(view.queryByRole("button", { name })).toBeNull();
      expect(view.queryByRole("heading", { name })).toBeNull();
      expect(view.getByRole("heading", { name: "Install Dev Tunnels CLI" }).title).toBe(
        "Install Dev Tunnels CLI",
      );
      expect(view.getAllByRole("img", { name: "Not completed" })).toHaveLength(3);
      expect(
        (view.getByRole("button", { name: "Install Dev Tunnels CLI" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      expect((view.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(view.queryByRole("progressbar")).toBeNull();
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
