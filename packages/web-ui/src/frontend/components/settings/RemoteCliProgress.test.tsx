import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { RemoteAccessStatus } from "../../../shared/remote-access";
import { i18n } from "../../i18n/setup";
import { RemoteCliProgress } from "./RemoteCliProgress";

test.each([
  ["uninstalling", "Uninstall Dev Tunnels CLI", "Uninstalling CLI…"],
  ["signing-in", "Sign in", "Signing in…"],
  ["signing-out", "Sign out", "Signing out…"],
  ["connecting", "Connect Tunnel", "Connecting…"],
  ["stopping", "Disconnect Tunnel", "Stopping…"],
] as const)(
  "%s uses the full track without percentage or download controls",
  async (activity, label, message) => {
    const window = new Window();
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <RemoteCliProgress activity={activity} onCancel={() => {}} onTogglePause={() => {}} />,
      );
      const bar = window.document.querySelector('[role="progressbar"]')!;
      expect(bar.getAttribute("aria-label")).toBe(label);
      expect(bar.getAttribute("aria-valuenow")).toBeNull();
      expect(bar.getAttribute("data-indeterminate")).toBe("false");
      expect(bar.getAttribute("title")).toContain(message);
      expect(window.document.querySelector("[data-activity=true]")).toBeTruthy();
      expect(bar.querySelector(".remote-cli-progress-fill")?.getAttribute("style")).toBe(
        "width:100%",
      );
      expect(window.document.querySelector(".remote-cli-progress-percent")).toBeNull();
      expect(window.document.querySelector("button")).toBeNull();
      expect(window.document.querySelector('[role="status"]')?.className).toBe("sr-only");
    } finally {
      await window.happyDOM.close();
    }
  },
);

test.each([
  [undefined, undefined, "Installing CLI…"],
  [{ received: 1048576 }, undefined, "Downloading: 1.0 / ? MB"],
  [{ received: 1048576, total: 0 }, undefined, "Downloading: 1.0 / ? MB"],
  [{ received: 0, total: 2097152 }, 0, "Downloading: 0.0 / 2.0 MB"],
  [{ received: 1048576, total: 2097152 }, 50, "Downloading: 1.0 / 2.0 MB"],
  [{ received: 3145728, total: 2097152 }, 100, "Downloading: 3.0 / 2.0 MB"],
] satisfies [RemoteAccessStatus["download"], number | undefined, string][])(
  "download %j reports actual progress without inventing a percentage",
  async (download, percent, message) => {
    const window = new Window();
    const container = window.document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<RemoteCliProgress download={download} />);
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-label")).toBe("Install Dev Tunnels CLI");
    expect(bar.getAttribute("aria-valuenow")).toBe(percent === undefined ? null : String(percent));
    expect(bar.getAttribute("aria-valuetext")).toBe(message);
    expect(bar.getAttribute("data-indeterminate")).toBe(String(percent === undefined));
    expect(container.querySelector('[role="status"]')?.textContent).toBe(message);
    expect(container.querySelector('[role="status"]')?.className).toBe("sr-only");
    expect(container.querySelector(".remote-cli-progress-percent")?.textContent).toBe(
      percent === undefined ? "—" : Math.floor(percent) + "%",
    );
    expect(container.querySelector(".remote-cli-progress-caption")).toBeNull();
    expect(container.querySelector(".remote-cli-progress-fill")?.getAttribute("style")).toBe(
      "width:" + (percent === undefined ? "28%" : percent + "%"),
    );
    expect(container.querySelector('[role="status"]')?.id).toBe(
      bar.getAttribute("aria-describedby"),
    );
    await window.happyDOM.close();
  },
);

test("progress tracks new byte counts and stays localized when the interface language changes", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const language = i18n.language;
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const view = render(<RemoteCliProgress download={{ received: 1, total: 4 }} />);
    const bar = view.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    view.rerender(<RemoteCliProgress download={{ received: 3, total: 4 }} />);
    expect(view.getByRole("progressbar")).toBe(bar);
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
    await act(async () => i18n.changeLanguage("zh"));
    expect(bar.getAttribute("aria-label")).toBe("安装 Dev Tunnels CLI");
    expect(view.getByRole("status").textContent).toContain("正在下载");
    view.rerender(<RemoteCliProgress download={{ received: 4, stage: "verifying" }} />);
    expect(view.getByRole("status").textContent).toBe("正在校验并安装…");
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each([undefined, 4])(
  "verification keeps activity visible without pause or a completion percentage; total=%s",
  async (total) => {
    const window = new Window();
    const container = window.document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <RemoteCliProgress
        download={{ received: 4, total, stage: "verifying", paused: true }}
        onTogglePause={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Verifying and installing…",
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.getAttribute("aria-valuetext")).toBe("Verifying and installing…");
    expect(container.querySelector(".remote-cli-progress-fill")?.getAttribute("style")).toBe(
      "width:100%",
    );
    expect(container.firstElementChild?.getAttribute("data-paused")).toBe("false");
    expect(container.querySelector("[data-action=pause]")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Stop / cancel");
    expect(container.querySelector(".remote-cli-progress-percent")?.textContent).toBe("—");
    expect(container.querySelector('[role="status"]')?.className).toBe("sr-only");
    await window.happyDOM.close();
  },
);

test("pause/resume precedes stop on the right and retains progress while paused", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const actions: string[] = [];
  const props = {
    onTogglePause: () => actions.push("toggle"),
    onCancel: () => actions.push("stop"),
  };
  try {
    const view = render(<RemoteCliProgress {...props} download={{ received: 1, total: 4 }} />);
    const pause = view.getByRole("button", { name: "Pause download" });
    const stop = view.getByRole("button", { name: "Stop and delete download" });
    expect(pause.parentElement?.getAttribute("data-action")).toBe("pause");
    expect(stop.parentElement?.getAttribute("data-action")).toBe("stop");
    expect(view.getAllByRole("button")).toEqual([pause, stop]);
    const bar = view.getByRole("progressbar");
    const percentage = bar.nextElementSibling!;
    expect(percentage.textContent).toBe("25%");
    expect(percentage.className).toBe("remote-cli-progress-percent");
    expect(percentage.nextElementSibling?.nextElementSibling).toBe(pause.parentElement);
    fireEvent.click(pause);
    view.rerender(
      <RemoteCliProgress {...props} download={{ received: 1, total: 4, paused: true }} />,
    );
    expect(view.getByRole("status").textContent).toBe("Download paused");
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(view.container.firstElementChild?.getAttribute("data-paused")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Resume download" }));
    fireEvent.click(stop);
    expect(actions).toEqual(["toggle", "toggle", "stop"]);
    view.rerender(
      <RemoteCliProgress
        {...props}
        controlsDisabled
        download={{ received: 1, total: 4, paused: true }}
      />,
    );
    for (const button of view.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.parentElement?.title).toBe(button.getAttribute("aria-label"));
    }
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
