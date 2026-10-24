import { expect, test, vi } from "vitest";

import type { DownloadProgress } from "./cli-download";
import type { RemoteRuntime } from "./cli-runtime";
import { RemoteAccessController } from "./controller";
import { RemoteAccessError } from "./errors";

const setup = (savedSignIn?: { value: boolean }, savedConnection?: { value: boolean }) => {
  let failed = () => {};
  const calls: string[] = [];
  const runtime: RemoteRuntime = {
    installed: vi.fn(async () => false),
    install: vi.fn(async (_signal, progress) => {
      calls.push("install");
      progress({ received: 10 });
    }),
    pauseDownload: vi.fn(() => false),
    uninstall: vi.fn(async () => {}),
    login: vi.fn(async () => {
      calls.push("login");
    }),
    logout: vi.fn(async () => {
      calls.push("logout");
    }),
    start: vi.fn(async (_signal, notify) => {
      failed = notify;
      calls.push("start");
      return "https://synthetic.devtunnels.ms";
    }),
    close: vi.fn(async () => {
      calls.push("close");
    }),
  };
  const controller = new RemoteAccessController({
    supported: true,
    signedIn: savedSignIn?.value,
    saveSignIn: async (signedIn) => {
      if (savedSignIn) savedSignIn.value = signedIn;
    },
    saveConnection: async (enabled) => {
      if (savedConnection) savedConnection.value = enabled;
    },
    runtime: () => runtime,
  });
  return { controller, runtime, calls, fail: () => failed() };
};

test("Connect installs, signs in and hosts without configuration; unexpected exit permits retry", async () => {
  const { controller, runtime, calls, fail } = setup();
  expect(controller.status()).toEqual({
    supported: true,
    installed: false,
    signedIn: false,
    phase: "off",
  });
  controller.command("start");
  expect(() => controller.command("start")).toThrow("busy");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  expect(calls).toEqual(["install", "login", "start"]);
  fail();
  await vi.waitFor(() => expect(controller.status().error).toBe("tunnel_failed"));
  expect(controller.status().failedSteps).toEqual(["start"]);
  runtime.installed = vi.fn(async () => true);
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  expect(runtime.install).toHaveBeenCalledOnce();
  expect(runtime.login).toHaveBeenCalledOnce();
  expect(controller.status().failedSteps).toBeUndefined();
  await controller.close();
  fail();
  expect(controller.status().phase).toBe("off");
});

test.each([
  ["login", false, "signing-in"],
  ["start", false, "signing-in"],
  ["start", true, "connecting"],
] as const)(
  "%s keeps its operation phase while checking an installed CLI; signedIn=%s",
  async (command, signedIn, phase) => {
    const { controller, runtime } = setup();
    runtime.installed = vi.fn(async () => true);
    await controller.refresh();
    if (signedIn) {
      controller.command("login");
      await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    }
    let finish = (_installed: boolean) => {};
    runtime.installed = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    try {
      controller.command(command);
      expect(controller.status()).toMatchObject({ installed: true, signedIn, phase });
      expect(await controller.refresh()).toMatchObject({ installed: true, phase });
      expect(controller.status().download).toBeUndefined();
      expect(runtime.install).not.toHaveBeenCalled();
      finish(true);
      await vi.waitFor(() =>
        expect(controller.status().phase).toBe(command === "login" ? "off" : "connected"),
      );
      expect(runtime.install).not.toHaveBeenCalled();
    } finally {
      finish(true);
      await controller.close();
    }
  },
);

test.each(["login", "start"] as const)(
  "%s returns to installation only when the CLI is actually missing",
  async (command) => {
    const { controller, runtime } = setup();
    runtime.installed = vi.fn(async () => true);
    await controller.refresh();
    runtime.installed = vi.fn(async () => false);
    runtime.install = vi.fn(async () => {
      expect(controller.status()).toMatchObject({ installed: false, phase: "installing" });
    });
    try {
      controller.command(command);
      expect(controller.status().phase).toBe("signing-in");
      await vi.waitFor(() =>
        expect(controller.status().phase).toBe(command === "login" ? "off" : "connected"),
      );
      expect(runtime.install).toHaveBeenCalledOnce();
      expect(controller.status().installed).toBe(true);
    } finally {
      await controller.close();
    }
  },
);

test("cancel stops verification and ignores late progress", async () => {
  const { controller, runtime } = setup();
  let progress = (_value: DownloadProgress) => {};
  runtime.install = vi.fn((signal, notify) => {
    progress = notify;
    return new Promise<void>((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("synthetic-private-error")), {
        once: true,
      }),
    );
  });
  controller.command("start");
  await vi.waitFor(() => expect(runtime.install).toHaveBeenCalled());
  progress({ received: 99, stage: "verifying" });
  controller.command("stop");
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  progress({ received: 99, stage: "verifying" });
  expect(controller.status().download).toBeUndefined();
  expect(runtime.login).not.toHaveBeenCalled();
  expect(controller.status().error).toBeUndefined();
  await controller.close();
});

test.each([false, true])(
  "verification completes only after installation; failure=%s",
  async (fail) => {
    const { controller, runtime } = setup();
    let finish = () => {};
    let notify = (_value: DownloadProgress) => {};
    runtime.install = vi.fn((_signal, progress) => {
      notify = progress;
      progress({ received: 10, total: 10 });
      return new Promise<void>((resolve, reject) => {
        finish = () => (fail ? reject(new RemoteAccessError("cli_integrity_failed")) : resolve());
      });
    });
    controller.command("install");
    await vi.waitFor(() => expect(runtime.install).toHaveBeenCalled());
    expect(controller.status().installed).toBe(false);
    notify({ received: 10, total: 10, stage: "verifying", paused: false });
    expect(await controller.refresh()).toMatchObject({
      phase: "installing",
      installed: false,
      download: { stage: "verifying" },
    });
    expect(() => controller.command("pause")).toThrow("Download is not active");
    finish();
    await vi.waitFor(() => expect(controller.status().phase).toBe(fail ? "error" : "off"));
    expect(controller.status().installed).toBe(!fail);
    expect(controller.status().download).toBeUndefined();
    expect(runtime.login).not.toHaveBeenCalled();
    await controller.close();
  },
);

test("cancel during login prevents late completion from starting hosting", async () => {
  const { controller, runtime } = setup();
  let finish = () => {};
  runtime.login = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  controller.command("start");
  await vi.waitFor(() => expect(runtime.login).toHaveBeenCalled());
  controller.command("stop");
  finish();
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(runtime.start).not.toHaveBeenCalled();
  expect(controller.status().signedIn).toBe(false);
  await controller.close();
});

test("logout after restart probes installed CLI without downloading and stops before logout", async () => {
  const { controller, runtime, calls } = setup();
  runtime.installed = vi.fn(async () => true);
  controller.command("logout");
  await vi.waitFor(() => expect(runtime.logout).toHaveBeenCalled());
  expect(calls).toEqual(["logout"]);
  expect(runtime.install).not.toHaveBeenCalled();
  await controller.close();
});

test("sign-out finishes stopping the tunnel before changing sign-in state or logging out", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup(saved);
  runtime.installed = vi.fn(async () => true);
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  let finishClose = () => {};
  let finishLogout = () => {};
  vi.mocked(runtime.close).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishClose = resolve;
      }),
  );
  vi.mocked(runtime.logout).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishLogout = resolve;
      }),
  );
  try {
    controller.command("logout");
    await vi.waitFor(() => expect(runtime.close).toHaveBeenCalledOnce());
    expect(await controller.refresh()).toMatchObject({ phase: "stopping", signedIn: true });
    expect(saved.value).toBe(true);
    expect(runtime.logout).not.toHaveBeenCalled();
    expect(() => controller.command("start")).toThrow("busy");
    finishClose();
    await vi.waitFor(() => expect(runtime.logout).toHaveBeenCalledOnce());
    expect(await controller.refresh()).toMatchObject({ phase: "signing-out", signedIn: false });
    expect(saved.value).toBe(false);
    expect(() => controller.command("logout")).toThrow("busy");
    finishLogout();
    await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    expect(controller.status()).toMatchObject({ installed: true, signedIn: false });
  } finally {
    finishClose();
    finishLogout();
    await controller.close();
  }
});

test("sign-out keeps the account signed in if stopping the tunnel fails", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup(saved);
  runtime.installed = vi.fn(async () => true);
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  vi.mocked(runtime.close).mockRejectedValueOnce(new RemoteAccessError("tunnel_failed"));
  try {
    controller.command("logout");
    await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
    expect(controller.status()).toMatchObject({
      signedIn: true,
      error: "tunnel_failed",
      errorStep: "start",
    });
    expect(saved.value).toBe(true);
    expect(runtime.logout).not.toHaveBeenCalled();
  } finally {
    await controller.close();
  }
});

test("installation alone never signs in, and errors expose only fixed codes", async () => {
  const { controller, runtime } = setup();
  runtime.install = vi.fn(async () => {
    throw new RemoteAccessError("cli_integrity_failed");
  });
  controller.command("install");
  await vi.waitFor(() => expect(controller.status().error).toBe("cli_integrity_failed"));
  runtime.install = vi.fn(async () => {});
  controller.command("install");
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(runtime.login).not.toHaveBeenCalled();
  runtime.start = vi.fn(async () => {
    throw new Error("synthetic-private-error");
  });
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().error).toBe("cli_failed"));
  expect(JSON.stringify(controller.status())).not.toContain("synthetic-private-error");
  await controller.close();
});

test("unsupported platforms do not load or install the CLI", async () => {
  const runtime = vi.fn();
  const controller = new RemoteAccessController({ supported: false, runtime });
  expect((await controller.refresh()).phase).toBe("off");
  controller.command("start");
  expect(controller.status().error).toBe("unsupported_platform");
  expect(runtime).not.toHaveBeenCalled();
  await controller.close();
});

test.each(["install", "login", "start"] as const)(
  "generic %s failure reports its owning step and clears it on retry",
  async (step) => {
    const { controller, runtime } = setup();
    const original = runtime[step];
    runtime[step] = vi.fn(async () => {
      throw new Error("Synthetic operation failure");
    });
    controller.command("start");
    await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
    expect(controller.status()).toMatchObject({ error: "cli_failed", errorStep: step });
    expect((await controller.refresh()).errorStep).toBe(step);
    Object.assign(runtime, { [step]: original });
    controller.command("start");
    expect(controller.status().errorStep).toBeUndefined();
    await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
    expect(controller.status().error).toBeUndefined();
    await controller.close();
  },
);

test("refresh checks installation without reading credentials or invoking CLI account commands", async () => {
  const { controller, runtime, calls } = setup();
  runtime.installed = vi.fn(async () => true);
  expect(await controller.refresh()).toMatchObject({
    installed: true,
    signedIn: false,
    phase: "off",
  });
  expect(calls).toEqual([]);
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(true));
  expect(await controller.refresh()).toMatchObject({ installed: true, signedIn: true });
  expect(calls).toEqual(["login"]);
  runtime.installed = vi.fn(async () => false);
  expect(await controller.refresh()).toMatchObject({ installed: false, signedIn: false });
  expect(controller.status().failedSteps).toEqual(["install"]);
  expect((await controller.refresh()).failedSteps).toEqual(["install"]);
  runtime.installed = vi.fn(async () => true);
  expect((await controller.refresh()).failedSteps).toBeUndefined();
  expect(calls).toEqual(["login"]);
  await controller.close();
});

test("denied sign-in settles loading and refresh never retries the account operation", async () => {
  const { controller, runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  runtime.login = vi.fn(async () => {
    throw new RemoteAccessError("sign_in_failed");
  });
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(controller.status()).toMatchObject({
    installed: true,
    signedIn: false,
    error: "sign_in_failed",
  });
  for (let i = 0; i < 3; i++) await controller.refresh();
  expect(runtime.login).toHaveBeenCalledOnce();
  expect(runtime.start).not.toHaveBeenCalled();
  await controller.close();
});

test("failed reauthorization invalidates a previously completed login until explicit recovery", async () => {
  const { controller, runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(true));
  runtime.login = vi.fn(async () => {
    throw new RemoteAccessError("sign_in_failed");
  });
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(controller.status()).toMatchObject({
    installed: true,
    signedIn: false,
    failedSteps: ["login"],
  });
  expect((await controller.refresh()).failedSteps).toEqual(["login"]);
  runtime.login = vi.fn(async () => {});
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(true));
  expect(controller.status().failedSteps).toBeUndefined();
  controller.command("logout");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(false));
  expect(controller.status().failedSteps).toBeUndefined();
  await controller.close();
});

test("refresh coalesces checks and rejects overlapping actions; stop discards late check results", async () => {
  const { controller, runtime, calls } = setup();
  let finish = (_value: boolean) => {};
  runtime.installed = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const first = controller.refresh();
  const second = controller.refresh();
  expect(runtime.installed).toHaveBeenCalledOnce();
  expect(() => controller.command("install")).toThrow("busy");
  controller.command("stop");
  finish(true);
  await Promise.all([first, second]);
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(controller.status()).toMatchObject({ installed: false, signedIn: false });
  expect(calls).toEqual(["close"]);
  await controller.close();
});

test("refresh leaves active operations and connected hosts intact, including on check failure", async () => {
  const { controller, runtime, calls } = setup();
  controller.command("start");
  expect((await controller.refresh()).phase).toBe("installing");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  runtime.installed = vi.fn(async () => true);
  const connected = await controller.refresh();
  expect(connected).toMatchObject({ phase: "connected", url: "https://synthetic.devtunnels.ms" });
  runtime.installed = vi.fn(async () => {
    throw new Error("synthetic-private-error");
  });
  await expect(controller.refresh()).rejects.toMatchObject({ code: "cli_failed" });
  expect(controller.status()).toEqual(connected);
  expect(calls).toEqual(["install", "login", "start"]);
  await controller.close();
  await expect(controller.refresh()).rejects.toThrow("closed");
});

test("close aborts a pending status check", async () => {
  const { controller, runtime } = setup();
  runtime.installed = vi.fn(
    (signal) =>
      new Promise<boolean>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  const refresh = controller.refresh();
  await controller.close();
  await refresh;
  expect(controller.status()).toMatchObject({ phase: "off", installed: false });
});

test("pause and resume only control active downloads; stop still cancels while paused", async () => {
  const { controller, runtime } = setup();
  expect(() => controller.command("pause")).toThrow();
  expect(() => controller.command("resume")).toThrow();
  let notify = (_value: { received: number; paused?: boolean }) => {};
  runtime.install = vi.fn((signal, progress) => {
    notify = progress;
    progress({ received: 8, total: 16, paused: false });
    return new Promise<void>((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
    );
  });
  runtime.pauseDownload = vi.fn((paused) => {
    notify({ received: 8, paused });
    return true;
  });
  controller.command("install");
  await vi.waitFor(() => expect(runtime.install).toHaveBeenCalled());
  controller.command("pause");
  expect(controller.status()).toMatchObject({
    phase: "installing",
    download: { received: 8, paused: true },
  });
  expect((await controller.refresh()).download?.paused).toBe(true);
  expect(() => controller.command("login")).toThrow("busy");
  controller.command("resume");
  expect(controller.status().download?.paused).toBe(false);
  runtime.pauseDownload = vi.fn(() => false);
  expect(() => controller.command("pause")).toThrow();
  controller.command("stop");
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(controller.status().download).toBeUndefined();
  await controller.close();
});

test("uninstall resets completion without logout; overlapping operations are rejected", async () => {
  const { controller, runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(true));
  let finish = () => {};
  runtime.uninstall = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  controller.command("uninstall");
  expect(controller.status().phase).toBe("uninstalling");
  expect(() => controller.command("install")).toThrow("busy");
  expect(() => controller.command("uninstall")).toThrow("busy");
  await vi.waitFor(() => expect(runtime.uninstall).toHaveBeenCalledOnce());
  finish();
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(controller.status()).toMatchObject({ installed: false, signedIn: false });
  expect(runtime.logout).not.toHaveBeenCalled();
  expect(runtime.install).not.toHaveBeenCalled();
  controller.command("start");
  expect(() => controller.command("uninstall")).toThrow("busy");
  await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
  expect(() => controller.command("uninstall")).toThrow("busy");
  expect(runtime.uninstall).toHaveBeenCalledOnce();
  await controller.close();
});

test("failed uninstall preserves installation and allows retry with a sanitized error", async () => {
  const { controller, runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  await controller.refresh();
  runtime.uninstall = vi.fn(async () => {
    throw new RemoteAccessError("cli_uninstall_failed");
  });
  controller.command("uninstall");
  await vi.waitFor(() => expect(controller.status().error).toBe("cli_uninstall_failed"));
  expect(controller.status().installed).toBe(true);
  runtime.uninstall = vi.fn(async () => {});
  controller.command("uninstall");
  await vi.waitFor(() => expect(controller.status().installed).toBe(false));
  expect(controller.status()).toMatchObject({ phase: "off", error: undefined });
  await controller.close();
});

test("remembered sign-in survives stop and restart and connects without another login", async () => {
  const saved = { value: false };
  const first = setup(saved);
  first.runtime.installed = vi.fn(async () => true);
  first.controller.command("login");
  await vi.waitFor(() => expect(first.controller.status().signedIn).toBe(true));
  expect(saved.value).toBe(true);
  await first.controller.close();
  const second = setup(saved);
  second.runtime.installed = vi.fn(async () => true);
  try {
    expect(await second.controller.refresh()).toMatchObject({ signedIn: true, phase: "off" });
    second.controller.command("start");
    await vi.waitFor(() => expect(second.controller.status().phase).toBe("connected"));
    expect(second.runtime.login).not.toHaveBeenCalled();
  } finally {
    await second.controller.close();
  }
  expect(saved.value).toBe(true);
});

test.each(["logout", "uninstall", "missing", "login-failed"] as const)(
  "%s clears the remembered sign-in across restart",
  async (action) => {
    const saved = { value: true };
    const { controller, runtime } = setup(saved);
    runtime.installed = vi.fn(async () => action !== "missing");
    runtime.login = vi.fn(async () => {
      throw new RemoteAccessError("sign_in_failed");
    });
    try {
      if (action === "missing") await controller.refresh();
      else {
        controller.command(action === "login-failed" ? "login" : action);
        await vi.waitFor(() =>
          expect(controller.status().phase).toBe(action === "login-failed" ? "error" : "off"),
        );
      }
      expect(controller.status().signedIn).toBe(false);
      expect(saved.value).toBe(false);
      const restarted = setup(saved);
      expect(restarted.controller.status().signedIn).toBe(false);
      await restarted.controller.close();
    } finally {
      await controller.close();
    }
  },
);

test("connection network failure preserves remembered login for a manual reconnect", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup(saved);
  runtime.installed = vi.fn(async () => true);
  runtime.start = vi.fn(async () => {
    throw new RemoteAccessError("tunnel_failed");
  });
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(controller.status().signedIn).toBe(true);
  expect(saved.value).toBe(true);
  expect(runtime.login).not.toHaveBeenCalled();
  await controller.close();
});

test("failed persistence does not confirm sign-in and prevents hosting", async () => {
  const { runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  const controller = new RemoteAccessController({
    supported: true,
    runtime: () => runtime,
    saveSignIn: async (signedIn) => {
      if (signedIn) throw new RemoteAccessError("sign_in_state_failed");
    },
  });
  controller.command("start");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(controller.status()).toMatchObject({
    signedIn: false,
    error: "sign_in_state_failed",
    errorStep: "login",
  });
  expect(runtime.start).not.toHaveBeenCalled();
  await controller.close();
});

test("failure to clear the saved marker blocks reauthorization and allows retry", async () => {
  const { runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  let failing = true;
  const controller = new RemoteAccessController({
    supported: true,
    signedIn: true,
    runtime: () => runtime,
    saveSignIn: async () => {
      if (failing) throw new RemoteAccessError("sign_in_state_failed");
    },
  });
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(controller.status().signedIn).toBe(false);
  expect(runtime.login).not.toHaveBeenCalled();
  failing = false;
  controller.command("login");
  await vi.waitFor(() => expect(controller.status().signedIn).toBe(true));
  expect(runtime.login).toHaveBeenCalledOnce();
  await controller.close();
});

test("failed logout clears the remembered result without claiming CLI logout succeeded", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup(saved);
  runtime.installed = vi.fn(async () => true);
  runtime.logout = vi.fn(async () => {
    throw new RemoteAccessError("cli_failed");
  });
  controller.command("logout");
  await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
  expect(saved.value).toBe(false);
  expect(controller.status()).toMatchObject({ signedIn: false, errorStep: "login" });
  await controller.close();
});

test("canceling reauthorization before CLI success keeps the persisted marker cleared", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup(saved);
  runtime.installed = vi.fn(async () => true);
  runtime.login = vi.fn(
    (signal) =>
      new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  controller.command("login");
  await vi.waitFor(() => expect(runtime.login).toHaveBeenCalledOnce());
  expect(saved.value).toBe(false);
  controller.command("stop");
  await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
  expect(controller.status().signedIn).toBe(false);
  expect(saved.value).toBe(false);
  await controller.close();
});

test.each([
  [false, true],
  [true, false],
] as const)(
  "restore never installs or signs in when prerequisites are missing; installed=%s signedIn=%s",
  async (installed, signedIn) => {
    const saved = { value: true };
    const { controller, runtime } = setup({ value: signedIn }, saved);
    runtime.installed = vi.fn(async () => installed);
    try {
      controller.restore();
      await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
      expect(saved.value).toBe(false);
      expect(runtime.install).not.toHaveBeenCalled();
      expect(runtime.login).not.toHaveBeenCalled();
      expect(runtime.start).not.toHaveBeenCalled();
    } finally {
      await controller.close();
    }
  },
);

test("restore shows connecting until CLI readiness and reports failure without automatic retries", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup({ value: true }, saved);
  runtime.installed = vi.fn(async () => true);
  let fail = (_error: Error) => {};
  runtime.start = vi.fn(
    () =>
      new Promise<string>((_resolve, reject) => {
        fail = reject;
      }),
  );
  try {
    controller.restore();
    controller.restore();
    await vi.waitFor(() => expect(runtime.start).toHaveBeenCalledOnce());
    expect(await controller.refresh()).toMatchObject({ phase: "connecting", signedIn: true });
    expect(controller.status().url).toBeUndefined();
    fail(new RemoteAccessError("tunnel_failed"));
    await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
    expect(controller.status()).toMatchObject({ errorStep: "start", signedIn: true });
    expect(saved.value).toBe(true);
    controller.restore();
    expect(runtime.start).toHaveBeenCalledOnce();
    controller.command("stop");
    await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    expect(saved.value).toBe(false);
  } finally {
    fail(new Error("Synthetic cleanup"));
    await controller.close();
  }
});

test.each(["start", "stop", "logout"] as const)(
  "%s preference-write failure closes hosting and reports Step 3 without claiming success",
  async (action) => {
    const { runtime } = setup();
    runtime.installed = vi.fn(async () => true);
    let failing = action === "start";
    const controller = new RemoteAccessController({
      supported: true,
      signedIn: true,
      runtime: () => runtime,
      saveConnection: async () => {
        if (failing) throw new RemoteAccessError("connection_state_failed");
      },
    });
    try {
      controller.command("start");
      if (action !== "start") {
        await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
        failing = true;
        controller.command(action);
      }
      await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
      expect(controller.status()).toMatchObject({
        error: "connection_state_failed",
        errorStep: "start",
        signedIn: true,
      });
      expect(controller.status().url).toBeUndefined();
      expect(runtime.close).toHaveBeenCalled();
      expect(runtime.logout).not.toHaveBeenCalled();
    } finally {
      await controller.close();
    }
  },
);

test("disconnect waits for a pending connection save and clears it before completing", async () => {
  const { runtime } = setup();
  runtime.installed = vi.fn(async () => true);
  let enabled = false;
  let finish = () => {};
  const controller = new RemoteAccessController({
    supported: true,
    signedIn: true,
    runtime: () => runtime,
    saveConnection: async (value) => {
      if (value)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      enabled = value;
    },
  });
  try {
    controller.command("start");
    await vi.waitFor(() => expect(runtime.start).toHaveBeenCalledOnce());
    expect(controller.status().phase).toBe("connecting");
    controller.command("stop");
    finish();
    await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    expect(enabled).toBe(false);
    expect(controller.status().url).toBeUndefined();
  } finally {
    finish();
    await controller.close();
  }
});

test("unexpected host exit preserves reconnect but explicit reauthorization clears it", async () => {
  const saved = { value: false };
  const { controller, runtime, fail } = setup({ value: true }, saved);
  runtime.installed = vi.fn(async () => true);
  try {
    controller.command("start");
    await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
    expect(saved.value).toBe(true);
    fail();
    await vi.waitFor(() => expect(controller.status().phase).toBe("error"));
    expect(saved.value).toBe(true);
    controller.command("login");
    await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    expect(saved.value).toBe(false);
  } finally {
    await controller.close();
  }
});

test("shutdown cancels restoration without clearing the reconnect preference", async () => {
  const saved = { value: true };
  const { controller, runtime } = setup({ value: true }, saved);
  runtime.installed = vi.fn(async () => true);
  runtime.start = vi.fn(
    (signal) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  controller.restore();
  await vi.waitFor(() => expect(runtime.start).toHaveBeenCalledOnce());
  await controller.close();
  expect(saved.value).toBe(true);
  expect(controller.status().phase).toBe("off");
  expect(controller.status().url).toBeUndefined();
});

test("automatic recovery rejects overlapping setup commands and Disconnect cancels it", async () => {
  const { controller, runtime } = setup({ value: true });
  runtime.installed = vi.fn(async () => true);
  let changed = (_url?: string) => {};
  runtime.start = vi.fn(async (_signal, _failed, update) => {
    changed = update!;
    return "https://example.test";
  });
  try {
    controller.command("start");
    await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
    changed();
    expect(controller.status().phase).toBe("connecting");
    for (const action of ["start", "login", "install", "uninstall"] as const)
      expect(() => controller.command(action)).toThrow("busy");
    controller.command("stop");
    await vi.waitFor(() => expect(controller.status().phase).toBe("off"));
    changed("https://example.test");
    expect(controller.status().phase).toBe("off");
    expect(runtime.start).toHaveBeenCalledOnce();
    expect(runtime.close).toHaveBeenCalledOnce();
  } finally {
    await controller.close();
  }
});

test("a late installation check cannot restore stale connected state during recovery", async () => {
  const { controller, runtime } = setup({ value: true });
  runtime.installed = vi.fn(async () => true);
  let changed = (_url?: string) => {};
  runtime.start = vi.fn(async (_signal, _failed, update) => {
    changed = update!;
    return "https://example.test";
  });
  try {
    controller.command("start");
    await vi.waitFor(() => expect(controller.status().phase).toBe("connected"));
    let finish!: (installed: boolean) => void;
    runtime.installed = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const checking = controller.refresh();
    changed();
    finish(true);
    await checking;
    expect(controller.status().phase).toBe("connecting");
    expect(controller.status().url).toBeUndefined();
    changed("https://example.test");
    expect(controller.status().phase).toBe("connected");
  } finally {
    await controller.close();
  }
});
