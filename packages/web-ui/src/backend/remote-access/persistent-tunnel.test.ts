import { afterEach, expect, test, vi } from "vitest";

import { runCli } from "./cli-process";
import { newTunnelRecord, prepareTunnel } from "./persistent-tunnel";
import { TunnelStore } from "./tunnel-store";

vi.mock("./cli-process", () => ({ runCli: vi.fn() }));

afterEach(() => vi.resetAllMocks());

test("creates a private persistent tunnel, saves its canonical ID and configures only the saved port", async () => {
  const store = new TunnelStore("unused");
  const save = vi.spyOn(store, "save").mockResolvedValue();
  const record = newTunnelRecord(1234);
  vi.mocked(runCli)
    .mockResolvedValueOnce(JSON.stringify({ tunnel: { tunnelId: "canonical.test" } }))
    .mockResolvedValueOnce(JSON.stringify({ warning: "No ports" }))
    .mockResolvedValueOnce("{}");
  expect(await prepareTunnel("cli", store, record, new AbortController().signal)).toEqual({
    tunnelId: "canonical.test",
    port: 1234,
    configured: true,
  });
  expect(save.mock.calls).toEqual([
    [{ tunnelId: "canonical.test", port: 1234, configured: false }],
    [{ tunnelId: "canonical.test", port: 1234, configured: true }],
  ]);
  const commands = vi.mocked(runCli).mock.calls.map(([, args]) => args);
  expect(commands[0]).toEqual([
    "create",
    record.tunnelId,
    "--expiration",
    "30d",
    "--host-header",
    "unchanged",
    "--origin-header",
    "unchanged",
    "--json",
  ]);
  expect(commands[2]).toEqual([
    "port",
    "create",
    "canonical.test",
    "--port-number",
    "1234",
    "--protocol",
    "http",
    "--host-header",
    "unchanged",
    "--origin-header",
    "unchanged",
    "--json",
  ]);
  expect(commands.flat()).not.toContain("--allow-anonymous");
});

test("resumes interrupted creation and port configuration without creating another identity", async () => {
  const store = new TunnelStore("unused");
  vi.spyOn(store, "save").mockResolvedValue();
  vi.mocked(runCli)
    .mockRejectedValueOnce(new Error("Already created"))
    .mockResolvedValueOnce(JSON.stringify({ tunnel: { tunnelId: "canonical.test" } }))
    .mockResolvedValueOnce(JSON.stringify({ ports: [{ portNumber: 1234, protocol: "http" }] }))
    .mockResolvedValueOnce("{}");
  await prepareTunnel(
    "cli",
    store,
    { tunnelId: "loop-synthetic", port: 1234, configured: false },
    new AbortController().signal,
  );
  expect(vi.mocked(runCli).mock.calls.map(([, args]) => args.slice(0, 2))).toEqual([
    ["create", "loop-synthetic"],
    ["show", "loop-synthetic"],
    ["port", "list"],
    ["port", "update"],
  ]);
});

test("missing canonical identity is not silently replaced; cancellation does not probe credentials", async () => {
  const store = new TunnelStore("unused");
  const save = vi.spyOn(store, "save").mockResolvedValue();
  const record = { tunnelId: "canonical.test", port: 1234, configured: false };
  vi.mocked(runCli).mockRejectedValue(new Error("Missing"));
  await expect(prepareTunnel("cli", store, record, new AbortController().signal)).rejects.toThrow(
    "Missing",
  );
  expect(runCli).toHaveBeenCalledOnce();
  expect(vi.mocked(runCli).mock.calls[0]![1]).toEqual(["show", "canonical.test", "--json"]);
  expect(save).not.toHaveBeenCalled();
  vi.mocked(runCli).mockClear();
  const abort = new AbortController();
  abort.abort();
  await expect(
    prepareTunnel("cli", store, { ...record, tunnelId: "pending" }, abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(runCli).not.toHaveBeenCalled();
});

test.each([
  { ports: [{ portNumber: 9999, protocol: "http" }] },
  { ports: [{ portNumber: 1234, protocol: "https" }] },
  {
    ports: [
      { portNumber: 1234, protocol: "http" },
      { portNumber: 9999, protocol: "http" },
    ],
  },
  {},
])("unexpected port configuration fails closed: %j", async (ports) => {
  const store = new TunnelStore("unused");
  vi.spyOn(store, "save").mockResolvedValue();
  vi.mocked(runCli)
    .mockResolvedValueOnce(JSON.stringify({ tunnel: { tunnelId: "canonical.test" } }))
    .mockResolvedValueOnce(JSON.stringify(ports));
  await expect(
    prepareTunnel(
      "cli",
      store,
      { tunnelId: "canonical.test", port: 1234, configured: false },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "tunnel_failed" });
  expect(runCli).toHaveBeenCalledTimes(2);
});
