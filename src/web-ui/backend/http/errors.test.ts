import { expect, test } from "bun:test";

import { errorResponse, HttpError } from "./errors";

test("HTTP errors preserve contract codes and unknown errors become failures", async () => {
  const response = errorResponse(new HttpError(409, "session_busy"));

  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("session_busy");
  expect(errorResponse(new Error("disk failed")).status).toBe(500);
});
