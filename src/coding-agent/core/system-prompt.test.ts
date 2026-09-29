import { expect, test } from "bun:test";

import { buildSystemPrompt } from "./system-prompt";

test("default instructions request concise visible updates before tools and after results", () => {
  const prompt = buildSystemPrompt(".", undefined, []);

  expect(prompt).toContain("Before each batch of tool calls");
  expect(prompt).toContain("in the user's language");
  expect(prompt).toContain("one or two sentences");
  expect(prompt).toContain("After tool results");
  expect(prompt).toContain("Do not reveal private chain-of-thought");
  expect(prompt).toContain("<!-- loop:commentary -->");
  expect(prompt).toContain("<!-- loop:final -->");
});

test("custom base instructions replace progress rules while retaining cwd and context", () => {
  expect(
    buildSystemPrompt(".", "Custom instructions", [{ path: "AGENTS.md", content: "Context" }]),
  ).toBe(
    "Custom instructions\n\nWorking directory: .\n\nProject instructions (AGENTS.md):\nContext",
  );
  expect(buildSystemPrompt(".", "", [])).not.toContain("Before each batch");
  expect(buildSystemPrompt(".", "Custom instructions", [])).not.toContain("<!-- loop:");
});
