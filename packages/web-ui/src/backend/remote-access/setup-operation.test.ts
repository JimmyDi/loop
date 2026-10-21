import { expect, test, vi } from "vitest";

import type { RemoteAccessStatus } from "../../shared/remote-access";
import type { RemoteRuntime } from "./cli-runtime";
import { runSetup } from "./setup-operation";

test.each([false, true])(
  "login completes only after saving; cancellation during save=%s",
  async (cancel) => {
    let state: RemoteAccessStatus = {
      supported: true,
      installed: true,
      signedIn: false,
      phase: "signing-in",
    };
    const abort = new AbortController();
    let finish = () => {};
    const runtime: RemoteRuntime = {
      installed: async () => true,
      install: vi.fn(),
      uninstall: vi.fn(),
      pauseDownload: () => false,
      login: vi.fn(async () => {
        expect(state.signedIn).toBe(false);
      }),
      logout: vi.fn(),
      start: vi.fn(async () => "https://example.com"),
      close: vi.fn(async () => {}),
    };
    const operation = runSetup(
      "start",
      {
        read: () => state,
        update: (value) => {
          state = value;
        },
        runtime: () => runtime,
        signIn: async (signedIn) => {
          if (signedIn)
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          state = { ...state, signedIn };
        },
        failed: vi.fn(),
      },
      abort.signal,
    );
    await vi.waitFor(() => expect(runtime.login).toHaveBeenCalledOnce());
    expect(state.signedIn).toBe(false);
    expect(state.phase).toBe("signing-in");
    expect(runtime.start).not.toHaveBeenCalled();
    if (cancel) {
      abort.abort();
      state = { ...state, phase: "stopping" };
    }
    finish();
    await operation;
    expect(state.phase).toBe(cancel ? "stopping" : "connected");
    expect(runtime.start).toHaveBeenCalledTimes(cancel ? 0 : 1);
  },
);
