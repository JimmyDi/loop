import { expect, test, vi } from "vitest";

import { discoverMcp } from "./discovery";

test("a setup attempt survives the normal deadline and still respects its own deadline", async () => {
  const deadlines: { ms: number; controller: AbortController }[] = [];
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    deadlines.push({ ms, controller });
    return controller.signal;
  });
  const ready = Promise.withResolvers<string>();
  const lifetime = new AbortController();
  try {
    const normal = discoverMcp(lifetime.signal, () => new Promise(() => {}));
    const setup = discoverMcp(lifetime.signal, () => ready.promise, undefined, 120_000);
    expect(deadlines.map((deadline) => deadline.ms)).toEqual([15_000, 120_000]);
    deadlines[0]!.controller.abort();
    await expect(normal).rejects.toThrow("connection_timeout");
    expect(deadlines[1]!.controller.signal.aborted).toBe(false);
    ready.resolve("connected");
    await expect(setup).resolves.toBe("connected");
    const hung = discoverMcp(lifetime.signal, () => new Promise(() => {}), undefined, 120_000);
    deadlines[2]!.controller.abort();
    await expect(hung).rejects.toThrow("connection_timeout");
  } finally {
    timeout.mockRestore();
  }
});

test("a cancelled discovery discards late results and never waits for an uncooperative connector", async () => {
  const lifetime = new AbortController();
  const ready = Promise.withResolvers<string>();
  const discard = vi.fn();
  const run = discoverMcp(lifetime.signal, () => ready.promise, discard);
  await Promise.resolve();
  lifetime.abort();
  await expect(run).rejects.toThrow("connection_timeout");
  ready.resolve("synthetic result");
  await vi.waitFor(() => expect(discard).toHaveBeenCalledWith("synthetic result"));
});
