import { expect, test } from "vitest";
import type { Message } from "@earendil-works/pi-ai";

import {
  prepareRuntimeContexts,
  projectRuntimeContexts,
  validateRuntimeContexts,
} from "./runtime-context";

test("context snapshots append only changes and preserve the prior request prefix", () => {
  const user = (content: string): Message => ({ role: "user", content, timestamp: 1 });
  const first = prepareRuntimeContexts([], "Read-only context", 0);
  const unchanged = prepareRuntimeContexts(first, "Read-only context", 1);
  const changed = prepareRuntimeContexts(unchanged, "Writable context", 1);
  const history = [user("First task"), user("Second task")];
  const before = projectRuntimeContexts(history.slice(0, 1), first);
  const after = projectRuntimeContexts(history, changed);

  expect(unchanged).toEqual(first);
  expect(changed).toHaveLength(2);
  expect(after.slice(0, before.length)).toEqual(before);
  expect(after.map((message) => message.content)).toEqual([
    "First task",
    "Read-only context",
    "Second task",
    "Writable context",
  ]);
  expect(history).toEqual([user("First task"), user("Second task")]);
  expect(first).toHaveLength(1);
  expect(projectRuntimeContexts(history, [])).toEqual(history);

  const cleared = prepareRuntimeContexts(changed, "", 2);
  expect(cleared.at(-1)?.content).toContain("Earlier runtime-context snapshots no longer apply");
  expect(prepareRuntimeContexts(cleared, "", 3)).toEqual(cleared);
  expect(prepareRuntimeContexts([], "", 0)).toEqual([]);
});

test("runtime context storage rejects invalid anchors and incomplete snapshots", () => {
  const messages: Message[] = [{ role: "user", content: "Task", timestamp: 1 }];
  const snapshot = { userTurn: 0, content: "Context", timestamp: 1 };

  expect(() => validateRuntimeContexts(undefined, messages)).not.toThrow();
  expect(() => validateRuntimeContexts([snapshot], messages)).not.toThrow();
  for (const invalid of [
    null,
    {},
    [null],
    [{ ...snapshot, userTurn: -1 }],
    [{ ...snapshot, userTurn: 1 }],
    [{ ...snapshot, userTurn: 0.5 }],
    [{ ...snapshot, content: " " }],
    [{ ...snapshot, timestamp: -1 }],
    [snapshot, snapshot],
  ]) {
    expect(() => validateRuntimeContexts(invalid, messages)).toThrow(
      "Invalid session runtime context",
    );
  }
});

test("repeated explicit skill loads preserve each turn and immutable revisions", () => {
  const skill = {
    id: "example",
    name: "example",
    path: "skills/example/SKILL.md",
    content: "Original body",
    revision: "first",
  };
  const first = prepareRuntimeContexts([], "Same context", 0, [skill]);
  const second = prepareRuntimeContexts(first, "Same context", 1, [skill]);
  const messages: Message[] = [
    { role: "user", content: "First", timestamp: 1 },
    { role: "user", content: "Second", timestamp: 2 },
  ];
  expect(() => validateRuntimeContexts(second, messages)).not.toThrow();
  const described = prepareRuntimeContexts([], "Context", 0, [
    { ...skill, description: "Review source" },
  ]);
  expect(() => validateRuntimeContexts(described, messages)).not.toThrow();
  expect(() =>
    validateRuntimeContexts(
      [{ ...described[0], skills: [{ ...skill, description: 12 }] }],
      messages,
    ),
  ).toThrow("Invalid session skill context");
  skill.content = "Updated body";
  expect(second).toHaveLength(2);
  expect(second.map((row) => row.skills?.[0]?.content)).toEqual(["Original body", "Original body"]);
});
