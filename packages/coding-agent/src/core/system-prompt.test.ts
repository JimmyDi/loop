import { expect, test } from "vitest";

import { buildSystemPrompt } from "./system-prompt";

test("default instructions keep coding guidance without tool narration or display protocols", () => {
  const prompt = buildSystemPrompt(".", undefined, []);

  expect(prompt).toContain("Read relevant files before editing");
  expect(prompt).toContain("Use tools to verify changes");
  expect(prompt).not.toContain("description");
  expect(prompt).not.toContain("narration");
  expect(prompt).not.toContain("progress update");
  expect(prompt).toContain("summarize the outcome and relevant verification");
  expect(prompt).not.toContain("Before each batch of tool calls");
  expect(prompt).not.toContain("After tool results");
  expect(prompt).toContain("Do not reveal private chain-of-thought");
  expect(prompt).not.toContain("<!-- loop:");
  expect(prompt).not.toContain("display marker");
});

test("custom base instructions replace defaults while retaining cwd and context", () => {
  expect(
    buildSystemPrompt(".", "Custom instructions", [{ path: "AGENTS.md", content: "Context" }]),
  ).toBe(
    "Custom instructions\n\nWorking directory: .\n\nProject instructions (AGENTS.md):\nContext",
  );
  expect(buildSystemPrompt(".", "", [])).toBe("\n\nWorking directory: .");
  expect(buildSystemPrompt(".", "Custom instructions", [])).not.toContain("<!-- loop:");
});
