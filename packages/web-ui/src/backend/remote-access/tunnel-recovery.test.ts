import { afterEach, expect, test, vi } from "vitest";

import { TunnelRecovery } from "./tunnel-recovery";

afterEach(() => vi.useRealTimers());

const setup = () => {
  vi.useFakeTimers();
  let exit = () => {};
  const hosts: {
    start: ReturnType<typeof vi.fn>;
    healthy: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[] = [];
  const create = vi.fn(() => {
    const host = {
      start: vi.fn(async (_signal: AbortSignal, failed: () => void) => {
        exit = failed;
        return "https://example.test";
      }),
      healthy: vi.fn(async () => true),
      close: vi.fn(async () => {}),
    };
    hosts.push(host);
    return host;
  });
  const recovery = new TunnelRecovery(create);
  const failed = vi.fn();
  const changed = vi.fn();
  const abort = new AbortController();
  const start = () => recovery.start(abort.signal, failed, changed);
  return { recovery, create, hosts, start, failed, changed, abort, exit: () => exit() };
};

test("hosting is confirmed only after fresh stable cloud connectivity", async () => {
  const context = setup();
  const ready = vi.fn();
  const started = context.start().then(ready);
  try {
    await vi.advanceTimersByTimeAsync(5999);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await started;
    expect(ready).toHaveBeenCalledWith("https://example.test");
    expect(context.hosts[0]!.healthy).toHaveBeenCalledTimes(7);
  } finally {
    await context.recovery.close();
  }
});

test("unexpected exit retries at the same address and stop cancels further attempts", async () => {
  const context = setup();
  const started = context.start();
  await vi.advanceTimersByTimeAsync(6000);
  await started;
  context.exit();
  expect(context.changed).toHaveBeenCalledWith();
  await vi.advanceTimersByTimeAsync(6999);
  expect(context.changed).not.toHaveBeenCalledWith("https://example.test");
  await vi.advanceTimersByTimeAsync(1);
  expect(context.changed).toHaveBeenLastCalledWith("https://example.test");
  expect(context.hosts[0]!.close).toHaveBeenCalledOnce();
  context.exit();
  await context.recovery.close();
  await vi.advanceTimersByTimeAsync(300_000);
  expect(context.create).toHaveBeenCalledTimes(2);
  expect(context.failed).not.toHaveBeenCalled();
});

test("unavailable control API and a single disconnected sample preserve a working host", async () => {
  const context = setup();
  const started = context.start();
  await vi.advanceTimersByTimeAsync(6000);
  await started;
  try {
    const healthy = context.hosts[0]!.healthy;
    healthy.mockRejectedValueOnce(new Error("Synthetic unavailable"));
    await vi.advanceTimersByTimeAsync(30_000);
    healthy.mockResolvedValueOnce(false);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(context.create).toHaveBeenCalledOnce();
    expect(context.changed).not.toHaveBeenCalled();
    healthy.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(context.changed).toHaveBeenCalledWith();
    await vi.advanceTimersByTimeAsync(7000);
    expect(context.changed).toHaveBeenLastCalledWith("https://example.test");
    expect(context.create).toHaveBeenCalledTimes(2);
  } finally {
    await context.recovery.close();
  }
});

test("six failed reconnects stop with one sanitized failure notification", async () => {
  const context = setup();
  const started = context.start();
  await vi.advanceTimersByTimeAsync(6000);
  await started;
  context.create.mockImplementation(() => {
    const host = {
      start: vi.fn(async () => {
        throw new Error("Synthetic private failure");
      }),
      healthy: vi.fn(async () => false),
      close: vi.fn(async () => {}),
    };
    context.hosts.push(host);
    return host;
  });
  context.exit();
  await vi.advanceTimersByTimeAsync(200_000);
  expect(context.create).toHaveBeenCalledTimes(7);
  expect(context.failed).toHaveBeenCalledExactlyOnceWith();
  await context.recovery.close();
  expect(context.hosts.every((host) => host.close.mock.calls.length >= 1)).toBe(true);
});

test("cancelling while verifying cloud readiness releases the host", async () => {
  const context = setup();
  const started = context.start();
  const rejected = expect(started).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(1000);
  context.abort.abort();
  await rejected;
  await context.recovery.close();
  expect(context.hosts[0]!.close).toHaveBeenCalledOnce();
  expect(context.failed).not.toHaveBeenCalled();
});

test("a printed URL without cloud connectivity times out instead of confirming success", async () => {
  const context = setup();
  const started = context.start();
  context.hosts[0]!.healthy.mockResolvedValue(false);
  const rejected = expect(started).rejects.toMatchObject({ code: "tunnel_failed" });
  await vi.advanceTimersByTimeAsync(45_000);
  await rejected;
  expect(context.changed).not.toHaveBeenCalled();
  await context.recovery.close();
});

test("host exit during a health probe triggers exactly one recovery", async () => {
  const context = setup();
  const started = context.start();
  await vi.advanceTimersByTimeAsync(6000);
  await started;
  let finish!: (healthy: boolean) => void;
  context.hosts[0]!.healthy.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await vi.advanceTimersByTimeAsync(30_000);
  context.exit();
  context.exit();
  finish(false);
  await vi.advanceTimersByTimeAsync(7000);
  expect(context.create).toHaveBeenCalledTimes(2);
  expect(context.changed.mock.calls).toEqual([[], ["https://example.test"]]);
  await context.recovery.close();
});
