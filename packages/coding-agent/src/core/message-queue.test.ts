import { expect, test } from "vitest";

import { MessageQueue } from "./message-queue";

test("editing preserves identity and position; moving and deleting reject consumed IDs", () => {
  const queue = new MessageQueue();
  queue.add("first", [], "a");
  queue.add("second", [], "b");
  queue.add("third", [], "c");
  queue.edit("b", "edited");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "b", "c"]);
  queue.move("c", "a");
  queue.remove("a");
  expect(queue.take()?.id).toBe("c");
  expect(() => queue.move("c", "b")).toThrow("no longer exists");
  expect(queue.take()?.content).toBe("edited");
});

test("steering chooses a selected item without consuming ordinary follow-ups", () => {
  const queue = new MessageQueue();
  queue.add("first", [], "a");
  queue.add("second", [], "b");
  expect(queue.take(true)).toBeUndefined();
  queue.steer("b");
  expect(() => queue.edit("b", "replacement")).toThrow("steering boundary");
  expect(queue.take(true)?.id).toBe("b");
  expect(queue.messages.map((item) => item.id)).toEqual(["a"]);
  const snapshot = queue.messages;
  snapshot[0]!.content = "mutated";
  expect(queue.take()?.content).toBe("first");
});

test("editing items are held in place while later items run; save and cancel release them", () => {
  const queue = new MessageQueue();
  queue.add("first", [], "a");
  queue.add("second", [], "b");
  queue.add("third", [], "c");
  queue.beginEdit("a");
  queue.beginEdit("b");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "b", "c"]);
  expect(queue.take()?.id).toBe("c");
  expect(queue.take()).toBeUndefined();
  expect(() => queue.steer("a")).toThrow("being edited");
  expect(() => queue.edit("a", "")).toThrow("Prompt is required");
  expect(queue.messages[0]?.editing).toBe(true);
  queue.edit("b", "saved");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "b"]);
  expect(queue.take()?.content).toBe("saved");
  queue.cancelEdit("a");
  expect(queue.take()?.content).toBe("first");
  expect(queue.take()).toBeUndefined();
});

test("held items can be moved or deleted without becoming executable", () => {
  const queue = new MessageQueue();
  queue.add("held", [], "a");
  queue.add("later", [], "b");
  queue.beginEdit("a");
  queue.move("a");
  expect(queue.take()?.id).toBe("b");
  expect(queue.take()).toBeUndefined();
  queue.remove("a");
  expect(() => queue.cancelEdit("a")).toThrow("no longer exists");
});

test("saving a bypassed edit appends it after remaining and newly queued messages", () => {
  const queue = new MessageQueue();
  queue.add("editing", [], "a");
  queue.add("later", [], "b");
  queue.add("remaining", [], "c");
  queue.beginEdit("a");
  expect(queue.take()?.id).toBe("b");
  queue.add("newer", [], "d");
  queue.beginEdit("a");
  expect(() => queue.edit("a", "")).toThrow("Prompt is required");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "c", "d"]);
  queue.edit("a", "saved");
  expect(queue.messages.map((item) => item.id)).toEqual(["c", "d", "a"]);
  expect(queue.take()?.id).toBe("c");
  expect(queue.take()?.id).toBe("d");
  expect(queue.take()).toMatchObject({ id: "a", content: "saved", editing: false });
});

test("steering a later item bypasses held edits while dispatching earlier items does not", () => {
  const queue = new MessageQueue();
  queue.add("earlier", [], "a");
  queue.add("editing", [], "b");
  queue.add("remaining", [], "c");
  queue.add("steering", [], "d");
  queue.beginEdit("b");
  queue.steer("a");
  expect(queue.take(true)?.id).toBe("a");
  queue.edit("b", "saved before bypass");
  expect(queue.messages.map((item) => item.id)).toEqual(["b", "c", "d"]);
  queue.beginEdit("b");
  queue.steer("d");
  expect(queue.take(true)?.id).toBe("d");
  queue.edit("b", "saved after bypass");
  expect(queue.messages.map((item) => item.id)).toEqual(["c", "b"]);
  queue.beginEdit("b");
  queue.add("newer", [], "e");
  queue.edit("b", "saved again");
  expect(queue.messages.map((item) => item.id)).toEqual(["c", "b", "e"]);
});

test("deleting a later item does not bypass an edit or leak state to a reused ID", () => {
  const queue = new MessageQueue();
  queue.add("editing", [], "a");
  queue.add("deleted", [], "b");
  queue.add("remaining", [], "c");
  queue.beginEdit("a");
  queue.remove("b");
  queue.edit("a", "saved");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "c"]);
  queue.beginEdit("a");
  expect(queue.take()?.id).toBe("c");
  queue.remove("a");
  queue.add("replacement", [], "a");
  queue.add("newer", [], "d");
  queue.beginEdit("a");
  queue.edit("a", "replacement saved");
  expect(queue.messages.map((item) => item.id)).toEqual(["a", "d"]);
});

test("saving before a later dispatch or cancelling a bypassed edit keeps its position", () => {
  const queue = new MessageQueue();
  queue.add("before", [], "a");
  queue.add("editing", [], "b");
  queue.add("later", [], "c");
  queue.beginEdit("b");
  expect(queue.take()?.id).toBe("a");
  queue.edit("b", "saved");
  expect(queue.messages.map((item) => item.id)).toEqual(["b", "c"]);
  queue.beginEdit("b");
  expect(queue.take()?.id).toBe("c");
  queue.add("newer", [], "d");
  queue.cancelEdit("b");
  expect(queue.messages.map((item) => item.id)).toEqual(["b", "d"]);
  queue.beginEdit("b");
  queue.edit("b", "saved again");
  expect(queue.messages.map((item) => item.id)).toEqual(["b", "d"]);
});

test("editing updates complete content and skill selections atomically while held", () => {
  const queue = new MessageQueue();
  queue.add("original", ["a".repeat(24)], "held");
  queue.beginEdit("held");
  expect(() => queue.edit("held", "changed", ["invalid"])).toThrow("Invalid skill");
  expect(queue.messages[0]).toMatchObject({
    content: "original",
    editing: true,
    skills: ["a".repeat(24)],
  });
  queue.edit("held", [{ type: "text", text: "Full updated content" }], []);
  expect(queue.take()).toMatchObject({
    content: [{ type: "text", text: "Full updated content" }],
    editing: false,
    skills: [],
  });
});
