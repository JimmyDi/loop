import { expect, test } from "vitest";

import { renderCodemodeOutput } from "./output";

test("retains explicit image output and failure details independently of text truncation", () => {
  const content = renderCodemodeOutput({
    ok: false,
    error: { kind: "script", message: "fixture error" },
    output: [
      { type: "text", text: "😀".repeat(20000) },
      { type: "image", data: "AA==", mimeType: "image/png" },
    ],
    calls: [{ name: "fixture", status: "ok", durationMs: 1 }],
  });
  expect(content.some((block) => block.type === "image")).toBe(true);
  expect(JSON.stringify(content)).toContain("fixture error");
  expect(JSON.stringify(content)).toContain("not rolled back");
  expect(JSON.stringify(content)).not.toContain("�");
});

test("caller options cannot enlarge text output or unbounded rejected-call summaries", () => {
  const content = renderCodemodeOutput(
    {
      ok: true,
      value: undefined,
      storeWrites: { set: {}, delete: [] },
      output: [{ type: "text", text: "文".repeat(4000) }],
      calls: Array.from({ length: 1000 }, () => ({
        name: "fixture",
        status: "error" as const,
        durationMs: 0,
      })),
    },
    100_000,
  );
  expect(JSON.stringify(content)).toContain("Output truncated");
  expect(JSON.stringify(content)).toContain("additional calls omitted");
  expect(JSON.stringify(content)).toContain("Nested calls");
  expect(JSON.stringify(content).length).toBeLessThan(5000);
});
