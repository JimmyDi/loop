import { afterEach, expect, test, vi } from "vitest";

import { runCli, startCliProcess } from "./cli-process";
import { CliTunnel } from "./cli-tunnel";

vi.mock("./cli-process", () => ({ startCliProcess: vi.fn(), runCli: vi.fn(async () => "") }));

afterEach(() => vi.clearAllMocks());

test("hosts a temporary private tunnel to isolated 503 ingress and deletes only its own tunnel", async () => {
  let exited!: (value: { code: number; output: string }) => void;
  let emit!: (line: string) => void;
  let port = "";
  const stop = vi.fn(async () => {
    exited({ code: 0, output: "" });
  });
  vi.mocked(startCliProcess).mockImplementation((_file, args, _signal, onLine) => {
    port = args[args.indexOf("--port-number") + 1]!;
    emit = onLine!;
    queueMicrotask(() => {
      emit("Inspect: https://synthetic-inspect.example.test");
      emit("Hosting port " + port + " at https://synthetic-" + port + ".test.devtunnels.ms/");
      emit("Ready to accept connections for tunnel: synthetic.test");
    });
    return {
      done: new Promise((resolve) => {
        exited = resolve;
      }),
      stop,
    };
  });
  const tunnel = new CliTunnel("synthetic-cli");
  const failed = vi.fn();
  const url = await tunnel.start(new AbortController().signal, failed);
  try {
    expect(url).toBe("https://synthetic-" + port + ".test.devtunnels.ms");
    const args = vi.mocked(startCliProcess).mock.calls[0]![1];
    expect(args).not.toContain("--allow-anonymous");
    expect(args).toContain("1h");
    const response = await fetch("http://127.0.0.1:" + port + "/api/remote-access");
    expect(response.status).toBe(503);
    exited({ code: 1, output: "synthetic-private-error" });
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
  } finally {
    await tunnel.close();
    await tunnel.close();
  }
  expect(stop).toHaveBeenCalledOnce();
  expect(runCli).toHaveBeenCalledWith(
    "synthetic-cli",
    ["delete", "synthetic.test", "--force"],
    expect.any(AbortSignal),
    10_000,
  );
});

test("early host failure does not report a connected tunnel and can be disposed", async () => {
  const stop = vi.fn(async () => {});
  vi.mocked(startCliProcess).mockReturnValue({
    done: Promise.resolve({ code: 1, output: "" }),
    stop,
  });
  const tunnel = new CliTunnel("synthetic-cli");
  const failed = vi.fn();
  await expect(tunnel.start(new AbortController().signal, failed)).rejects.toMatchObject({
    code: "tunnel_failed",
  });
  await tunnel.close();
  expect(failed).not.toHaveBeenCalled();
  expect(runCli).not.toHaveBeenCalled();
});

test("managed ingress receives the verified origin and closes before the CLI host stops", async () => {
  const connected = vi.fn();
  const close = vi.fn(async () => {});
  const stop = vi.fn(async () => {
    expect(close).toHaveBeenCalled();
  });
  vi.mocked(startCliProcess).mockImplementation((_file, _args, _signal, onLine) => {
    queueMicrotask(() => {
      onLine!("Hosting port at https://synthetic-1234.test.devtunnels.ms/");
      onLine!("Ready to accept connections for tunnel: synthetic.test");
    });
    return { done: new Promise(() => {}), stop };
  });
  const tunnel = new CliTunnel("synthetic-cli", async () => ({ port: 1234, close, connected }));
  expect(await tunnel.start(new AbortController().signal, vi.fn())).toBe(
    "https://synthetic-1234.test.devtunnels.ms",
  );
  expect(connected).toHaveBeenCalledWith("https://synthetic-1234.test.devtunnels.ms");
  await tunnel.close();
  expect(stop).toHaveBeenCalledOnce();
});
