import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

import { useRequests } from "./request-store";

test("unconfirmed request identity survives view switching until acknowledged", () => {
  const request = { requestId: "request", streamId: "stream", text: "hello" };

  useRequests.getState().put("session", request);
  expect(useRequests.getState().pending.session).toEqual(request);
  useRequests.getState().put("session");
  expect(useRequests.getState().pending.session).toBeUndefined();
});

test("delivery status follows the current request and ignores stale responses", () => {
  const original = useRequests.getState();
  const request = { requestId: "request", streamId: "stream", text: "hello" };
  try {
    useRequests.getState().put("session", request, "sending");
    expect(useRequests.getState().delivery.session).toBe("sending");
    useRequests.getState().markDelivery("session", request.requestId, "accepted");
    expect(useRequests.getState().delivery.session).toBe("accepted");
    useRequests.getState().markDelivery("session", request.requestId);
    expect(useRequests.getState().delivery.session).toBeUndefined();
    expect(useRequests.getState().pending.session).toEqual(request);
    useRequests.getState().put("session", { ...request, requestId: "new" }, "sending");
    useRequests.getState().markDelivery("session", request.requestId, "accepted");
    expect(useRequests.getState().delivery.session).toBe("sending");
    useRequests.getState().put("session");
    useRequests.getState().markDelivery("session", "new", "accepted");
    expect(useRequests.getState().delivery.session).toBeUndefined();
    expect(useRequests.getState().pending.session).toBeUndefined();
  } finally {
    useRequests.setState(original, true);
  }
});

test("unconfirmed text files restore with their exact request and reject malformed saved files", () => {
  const result = spawnProcessSync(
    [
      process.execPath,
      "--conditions=loop-source",
      "--import",
      import.meta.resolve("tsx"),
      "--eval",
      `
    import { expect } from "expect";
    const request = { requestId: "request", streamId: "stream", text: "", files: [{ name: "example.ts", text: "const x = 1;" }] };
    const stored = new Map([["loop.web.requests", JSON.stringify({ valid: request, invalid: { ...request, files: [{ name: "example.zip", text: "binary" }] } })]]);
    globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
    const { useRequests } = await import("./request-store.ts");
    expect(useRequests.getState().pending.valid).toEqual(request);
    expect(useRequests.getState().pending.invalid).toBeUndefined();
    expect(useRequests.getState().delivery).toEqual({});
    useRequests.getState().put("second", request, "sending");
    useRequests.getState().markDelivery("second", request.requestId, "accepted");
    expect(JSON.parse(stored.get("loop.web.requests")).second).toEqual(request);
    expect([...stored.keys()]).toEqual(["loop.web.requests"]);
  `,
    ],
    { cwd: import.meta.dirname },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

const spawnProcessSync = (argv: string[], options: { cwd?: string } = {}) => {
  const result = spawnSync(argv[0]!, argv.slice(1), options);
  return { ...result, exitCode: result.status };
};
