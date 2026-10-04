import { expect, test } from "bun:test";
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
