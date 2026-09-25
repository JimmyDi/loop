import { expect, test } from "bun:test";

import { api, ApiError } from "./api";

test("HTTP errors preserve status and machine-readable code", async () => {
  const original = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      Response.json(
        { code: "session_busy", message: "Busy" },
        { status: 409 },
      )) as unknown as typeof fetch;
    const error = await api("/sessions").catch((error) => error);

    expect(error).toBeInstanceOf(ApiError);

    if (!(error instanceof ApiError)) throw new Error("Expected API error");

    expect(error.code).toBe("session_busy");
    expect(error.status).toBe(409);
  } finally {
    globalThis.fetch = original;
  }
});
