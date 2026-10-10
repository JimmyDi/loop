import { expect, test } from "vitest";
import { NothingToCompactError } from "@loop/coding-agent";

import { errorResponse, HttpError } from "./errors";

test("HTTP errors preserve contract codes and unknown errors become failures", async () => {
  const response = errorResponse(new HttpError(409, "session_busy"));

  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("session_busy");
  expect(errorResponse(new Error("disk failed")).status).toBe(500);
});

test("short context returns a recognizable notice instead of an internal server error", async () => {
  const response = errorResponse(new NothingToCompactError());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    code: "nothing_to_compact",
    message: "Nothing to compact",
  });
});
