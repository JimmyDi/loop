import { expect, test } from "bun:test";

import { useRequests } from "./request-store";

test("unconfirmed request identity survives view switching until acknowledged", () => {
  const request = { requestId: "request", streamId: "stream", text: "hello" };

  useRequests.getState().put("session", request);
  expect(useRequests.getState().pending.session).toEqual(request);
  useRequests.getState().put("session");
  expect(useRequests.getState().pending.session).toBeUndefined();
});

test("unconfirmed text files restore with their exact request and reject malformed saved files", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
    import { expect } from "bun:test";
    const request = { requestId: "request", streamId: "stream", text: "", files: [{ name: "example.ts", text: "const x = 1;" }] };
    const stored = new Map([["loop.web.requests", JSON.stringify({ valid: request, invalid: { ...request, files: [{ name: "example.zip", text: "binary" }] } })]]);
    globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
    const { useRequests } = await import("./request-store.ts");
    expect(useRequests.getState().pending.valid).toEqual(request);
    expect(useRequests.getState().pending.invalid).toBeUndefined();
    useRequests.getState().put("second", request);
    expect(JSON.parse(stored.get("loop.web.requests")).second).toEqual(request);
  `,
    ],
    { cwd: import.meta.dir },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
