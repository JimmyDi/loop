import { expect, test } from "vitest";

import { sanitizeTraceData } from "./redaction";

test("credentials and images are excluded before local storage without modifying inputs", () => {
  const input = {
    headers: { Authorization: "Bearer synthetic-token" },
    text: "password=synthetic-password Authorization: Bearer synthetic-token",
    image: { type: "image", data: "synthetic-image", mimeType: "image/png" },
    toolCallId: "synthetic-call",
  };
  const result = sanitizeTraceData(input);
  expect(result).toEqual({
    headers: "[REDACTED]",
    text: "password=[REDACTED] Authorization: [REDACTED]",
    image: { type: "image", data: "[IMAGE_OMITTED]", mimeType: "image/png" },
    toolCallId: "synthetic-call",
  });
  expect(input.headers.Authorization).toContain("synthetic-token");
});

test("long unbroken tool text remains readable and non-HTTP credentials are filtered", () => {
  const text = "x".repeat(1024 * 1024);
  expect(sanitizeTraceData({ text })).toEqual({ text });
  expect(sanitizeTraceData("db://synthetic-user:synthetic-password@example.test/store")).toBe(
    "db://[REDACTED]@example.test/store",
  );
});

test("metadata filtering skips content before reading or redacting it", () => {
  const input = {
    toolCallId: "synthetic-call",
    result: {
      usage: { tokens: 2 },
      get content(): never {
        throw new Error("Content must not be inspected in metadata mode");
      },
    },
    apiKey: "synthetic credential",
  };
  expect(sanitizeTraceData(input, "metadata")).toEqual({
    toolCallId: "synthetic-call",
    result: { usage: { tokens: 2 } },
    apiKey: "[REDACTED]",
  });
});
