import { expect, test } from "vitest";

import { buildSystemPrompt } from "./system-prompt";

test("default instructions require a text plan before every tool batch in the same response", () => {
  const prompt = buildSystemPrompt(".", undefined, []);

  expect(prompt).toContain("Read relevant files before editing");
  expect(prompt).toContain("Use tools to verify changes");
  expect(prompt).not.toContain("description");
  expect(prompt).toContain("as ordinary assistant text");
  expect(prompt).toContain("Before each batch of tool calls");
  expect(prompt).toContain("non-empty, concise plan");
  expect(prompt).toContain("before the first tool call in that same response");
  expect(prompt).toContain("one plan covers all calls in that batch, not later responses");
  expect(prompt).toContain(
    "every further response containing tool calls must begin with a new plan",
  );
  expect(prompt).toContain("continued work, retries and verification");
  expect(prompt).toContain("Do not return tool calls without this text");
  expect(prompt).toContain("put the plan only in thinking or tool arguments");
  expect(prompt).toContain("standalone plan response without the intended calls");
  expect(prompt).toContain("do not claim success before tool results confirm it");
  expect(prompt).toContain("summarize the outcome and relevant verification");
  expect(prompt).not.toContain("several calls and subsequent tool batches");
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
