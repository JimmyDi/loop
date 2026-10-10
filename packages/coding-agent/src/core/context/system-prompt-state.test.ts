import { expect, test } from "vitest";

import { prepareSystemPromptState, validateSystemPromptState } from "./system-prompt-state";

test("stores the initial sections, only changed sections and explicit removals", () => {
  const initial =
    "Assistant\n\n<rules>\nVerify edits.\n</rules>\n\n<permissions>\nRead only.\n</permissions>";
  const first = prepareSystemPromptState([], initial, 1);
  expect(first[0]?.sections).toEqual({
    preamble: "Assistant",
    rules: "<rules>\nVerify edits.\n</rules>",
    permissions: "<permissions>\nRead only.\n</permissions>",
  });
  expect(prepareSystemPromptState(first, initial, 3)).toEqual(first);
  const updated = prepareSystemPromptState(first, initial.replace("Read only.", "Full access."), 3);
  expect(updated[1]?.sections).toEqual({
    permissions: "<permissions>\nFull access.\n</permissions>",
  });
  const removed = prepareSystemPromptState(
    updated,
    "Assistant\n\n<rules>\nVerify edits.\n</rules>",
    5,
  );
  expect(removed[2]?.sections).toEqual({ permissions: null });
  expect(first).toHaveLength(1);
  const messages = Array.from({ length: 5 }, () => ({
    role: "user" as const,
    content: "Task",
    timestamp: 1,
  }));
  expect(() => validateSystemPromptState(removed, messages)).not.toThrow();
  for (const value of [
    null,
    [{ ...first[0], messageCount: 6 }],
    [{ ...first[0], sections: { invalid: 12 } }],
  ])
    expect(() => validateSystemPromptState(value, messages)).toThrow(
      "Invalid system prompt checkpoints",
    );
});
