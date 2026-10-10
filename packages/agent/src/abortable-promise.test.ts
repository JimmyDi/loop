import { expect, test, vi } from "vitest";

import { abortable } from "./abortable-promise";

test("cancels pending waits and handles late rejection while removing the abort listener", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const pending = Promise.withResolvers<string>();
  const reason = new Error("Cancelled");
  const waiting = abortable(pending.promise, controller.signal);
  const rejected = expect(waiting).rejects.toBe(reason);
  controller.abort(reason);
  await rejected;
  pending.reject(new Error("Late provider failure"));
  await vi.waitFor(() => expect(remove).toHaveBeenCalledWith("abort", expect.any(Function)));
});

test("settled waits remove listeners and pre-aborted waits preserve the original reason", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  expect(await abortable(Promise.resolve("done"), controller.signal)).toBe("done");
  await Promise.resolve();
  expect(remove).toHaveBeenCalledTimes(1);
  const reason = new Error("Already cancelled");
  controller.abort(reason);
  await expect(abortable(Promise.resolve("done"), controller.signal)).rejects.toBe(reason);
});
