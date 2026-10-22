import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { runCli, startCliProcess } from "./cli-process";
import { CliTunnel } from "./cli-tunnel";
import { TunnelStore } from "./tunnel-store";

vi.mock("./cli-process", () => ({ startCliProcess: vi.fn(), runCli: vi.fn() }));

afterEach(() => vi.clearAllMocks());

test("reuses a persisted private tunnel and port across restart without deleting it", async () => {
  const directory = await mkdtemp(join(import.meta.dirname, ".tunnel-test-"));
  const file = join(directory, "tunnel.json");
  const store = new TunnelStore(file);
  let port = 0;
  vi.mocked(runCli).mockImplementation(async (_file, args) => {
    if (args[0] === "create") return JSON.stringify({ tunnel: { tunnelId: "synthetic.test" } });
    if (args[0] === "port" && args[1] === "list")
      return JSON.stringify(
        port ? { ports: [{ portNumber: port, protocol: "http" }] } : { warning: "No ports" },
      );
    if (args[0] === "port" && args[1] === "create")
      port = Number(args[args.indexOf("--port-number") + 1]);
    return "{}";
  });
  const stops: ReturnType<typeof vi.fn>[] = [];
  const exits: ((value: { code: number; output: string }) => void)[] = [];
  vi.mocked(startCliProcess).mockImplementation((_file, args, _signal, onLine) => {
    expect(args[1]).toBe("synthetic.test");
    queueMicrotask(() => {
      onLine!("Inspect: https://synthetic-inspect.example.test");
      onLine!("Hosting at https://synthetic-" + port + ".test.devtunnels.ms/");
      onLine!("Ready to accept connections for tunnel: synthetic.test");
    });
    let finish!: (value: { code: number; output: string }) => void;
    const done = new Promise<{ code: number; output: string }>((resolve) => {
      finish = resolve;
    });
    exits.push(finish);
    const stop = vi.fn(async () => {
      finish({ code: 0, output: "" });
    });
    stops.push(stop);
    return { done, stop };
  });
  let tunnel: CliTunnel | undefined;
  try {
    tunnel = new CliTunnel("synthetic-cli", store);
    const failed = vi.fn();
    const first = await tunnel.start(new AbortController().signal, failed);
    expect((await fetch("http://127.0.0.1:" + port)).status).toBe(503);
    const args = vi.mocked(startCliProcess).mock.calls[0]![1];
    expect(args).not.toContain("--allow-anonymous");
    expect(args).not.toContain("--port-number");
    expect(args).not.toContain("--expiration");
    expect(args.slice(args.indexOf("--host-header"), args.indexOf("--host-header") + 2)).toEqual([
      "--host-header",
      "unchanged",
    ]);
    expect(
      args.slice(args.indexOf("--origin-header"), args.indexOf("--origin-header") + 2),
    ).toEqual(["--origin-header", "unchanged"]);
    await tunnel.close();
    await tunnel.close();
    const count = vi.mocked(runCli).mock.calls.length;
    tunnel = new CliTunnel("synthetic-cli", new TunnelStore(file));
    expect(await tunnel.start(new AbortController().signal, failed)).toBe(first);
    expect(vi.mocked(runCli).mock.calls).toHaveLength(count + 1);
    expect(vi.mocked(runCli).mock.calls.at(-1)![1]).toEqual([
      "port",
      "list",
      "synthetic.test",
      "--json",
    ]);
    exits[1]!({ code: 1, output: "synthetic-private-error" });
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
  } finally {
    await tunnel?.close();
    await rm(directory, { recursive: true, force: true });
  }
  expect(stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  expect(vi.mocked(runCli).mock.calls.some(([, args]) => args[0] === "delete")).toBe(false);
});

test("early host failure preserves the saved identity and closes ingress first", async () => {
  vi.mocked(runCli).mockResolvedValue(
    JSON.stringify({ ports: [{ portNumber: 1234, protocol: "http" }] }),
  );
  const store = new TunnelStore("unused");
  vi.spyOn(store, "read").mockResolvedValue({
    tunnelId: "synthetic.test",
    port: 1234,
    configured: true,
  });
  const close = vi.fn(async () => {});
  const connected = vi.fn();
  const stop = vi.fn(async () => {
    expect(close).toHaveBeenCalled();
  });
  vi.mocked(startCliProcess).mockReturnValue({
    done: Promise.resolve({ code: 1, output: "" }),
    stop,
  });
  const tunnel = new CliTunnel("synthetic-cli", store, async () => ({
    port: 1234,
    close,
    connected,
  }));
  const failed = vi.fn();
  await expect(tunnel.start(new AbortController().signal, failed)).rejects.toMatchObject({
    code: "tunnel_failed",
  });
  await tunnel.close();
  expect(failed).not.toHaveBeenCalled();
  expect(connected).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
  expect(runCli).toHaveBeenCalledOnce();
});

test("occupied saved port fails without replacing the tunnel or picking another port", async () => {
  const store = new TunnelStore("unused");
  vi.spyOn(store, "read").mockResolvedValue({
    tunnelId: "synthetic.test",
    port: 1234,
    configured: true,
  });
  const ingress = vi.fn(async () => {
    throw Object.assign(new Error("occupied"), { code: "EADDRINUSE" });
  });
  const tunnel = new CliTunnel("synthetic-cli", store, ingress);
  await expect(tunnel.start(new AbortController().signal, vi.fn())).rejects.toMatchObject({
    code: "EADDRINUSE",
  });
  expect(ingress).toHaveBeenCalledExactlyOnceWith(1234);
  expect(startCliProcess).not.toHaveBeenCalled();
  await tunnel.close();
});
