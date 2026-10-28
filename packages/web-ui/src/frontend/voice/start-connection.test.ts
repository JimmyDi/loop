import { expect, test, vi } from "vitest";

import { voiceCommand } from "./request";
import { startConnection } from "./start-connection";

vi.mock("./request", () => ({ voiceCommand: vi.fn() }));

test("backend preparation waits for previous close and requests recognition only", async () => {
  vi.mocked(voiceCommand).mockReset();
  const closing = Promise.withResolvers<void>();
  const connection = { callId: "call", ticket: "ticket", expiresAt: 123 };
  vi.mocked(voiceCommand).mockResolvedValue(connection);
  const signal = new AbortController().signal;
  const pending = startConnection(
    {
      waitForClose: closing.promise,
      signal,
      mode: "dictation",
      synthesis: false,
      event: vi.fn(),
      status: vi.fn(),
      failed: vi.fn(),
    },
    "client",
    signal,
  );
  expect(voiceCommand).not.toHaveBeenCalled();
  closing.resolve();
  await expect(pending).resolves.toEqual(connection);
  expect(voiceCommand).toHaveBeenCalledWith(
    "/voice/calls",
    expect.objectContaining({ synthesis: false }),
    expect.anything(),
  );
});

test("cancelled parallel startup closes a backend call that finishes late", async () => {
  vi.mocked(voiceCommand).mockReset();
  const response = Promise.withResolvers<unknown>();
  vi.mocked(voiceCommand).mockImplementationOnce(() => response.promise as Promise<never>);
  vi.mocked(voiceCommand).mockResolvedValue(undefined);
  const controller = new AbortController();
  const pending = startConnection(
    {
      signal: controller.signal,
      mode: "dictation",
      event: vi.fn(),
      status: vi.fn(),
      failed: vi.fn(),
    },
    "client",
    controller.signal,
  );
  await Promise.resolve();
  controller.abort();
  response.resolve({ callId: "late-call" });
  await expect(pending).rejects.toThrow();
  expect(voiceCommand).toHaveBeenLastCalledWith("/voice/calls/late-call/close", {
    clientId: "client",
  });
});
