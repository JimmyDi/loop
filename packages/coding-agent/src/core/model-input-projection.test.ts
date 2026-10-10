import type { Message } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { projectModelInput } from "./model-input-projection";
import type { CompactionCheckpoint } from "./context/compaction-checkpoint";

test("long Skill instructions preserve the complete original user text at the end of string input", () => {
  const original = "Explain this skill.\nKeep the answer short.\n";
  const instructions =
    '<skill name="example" location="/workspace/.agents/skills/example/SKILL.md">\n' +
    "Review the workflow.\n".repeat(1000) +
    "</skill>";
  const messages: Message[] = [{ role: "user", content: original, timestamp: 1 }];
  const result = projectModelInput(
    messages,
    [{ userTurn: 0, content: instructions, placement: "user", timestamp: 1 }],
    { historyMessageCount: 1, sources: [{ type: "history", messageIndex: 0 }] },
  );
  expect(messages[0]?.content).toBe(original);
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]).toEqual({
    role: "user",
    content: instructions + "\n\n" + original,
    timestamp: 1,
  });
  const serialized = JSON.stringify(result.messages, null, 2);
  expect((JSON.parse(serialized) as Message[])[0]?.content).toBe(instructions + "\n\n" + original);
  expect(result.projection.sources).toEqual([{ type: "history", messageIndex: 0 }]);
});

test("expands selected instructions into user text and images without changing originals, including after compaction", () => {
  const image = { type: "image" as const, data: "AAAA", mimeType: "image/png" };
  const messages: Message[] = [
    { role: "user", content: "Old question", timestamp: 1 },
    { role: "user", content: [{ type: "text", text: "Review this" }, image], timestamp: 2 },
  ];
  const snapshots = [
    {
      userTurn: 1,
      content: "<skill>Review instructions</skill>",
      timestamp: 2,
      placement: "user" as const,
    },
  ];
  const metadata = {
    historyMessageCount: 2,
    sources: messages.map((_, messageIndex) => ({ type: "history" as const, messageIndex })),
  };
  const checkpoint = {
    id: "checkpoint",
    firstKeptMessageIndex: 1,
    summary: "Old goal",
    timestamp: 3,
  } as CompactionCheckpoint;
  const result = projectModelInput(messages, snapshots, metadata, checkpoint);
  expect(result.messages).toHaveLength(2);
  expect(result.messages[0]?.content).toContain("<summary>\nOld goal\n</summary>");
  expect(result.messages[1]?.content).toEqual([
    { type: "text", text: snapshots[0]!.content },
    { type: "text", text: "Review this" },
    image,
  ]);
  expect(result.projection.sources[0]).toMatchObject({ type: "compaction", summarizedBefore: 1 });
  expect(result.projection.skillExpansions).toEqual([
    { messageIndex: 1, snapshotIndex: 0, skills: [] },
  ]);
  expect(messages[1]?.content).toHaveLength(2);
});

test("duplicate messages and skill revisions retain original indexes after failed replies are filtered", () => {
  const user: Message = { role: "user", content: "Review this", timestamp: 1 };
  const messages = [user, structuredClone(user)];
  const skill = {
    id: "review",
    name: "review",
    path: ".agents/skills/review/SKILL.md",
    content: "Original instructions",
    revision: "first",
  };
  const snapshots = [
    { userTurn: 0, content: skill.content, timestamp: 1, skills: [skill] },
    {
      userTurn: 1,
      content: "Updated instructions",
      timestamp: 1,
      skills: [{ ...skill, revision: "second", content: "Updated instructions" }],
    },
  ];
  const metadata = {
    historyMessageCount: 4,
    sources: [
      { type: "history" as const, messageIndex: 0 },
      { type: "history" as const, messageIndex: 3 },
    ],
  };
  const before = structuredClone({ messages, snapshots, metadata });
  const result = projectModelInput(messages, snapshots, metadata);
  expect(result.messages.map((message) => message.content)).toEqual([
    "Review this",
    "Original instructions",
    "Review this",
    "Updated instructions",
  ]);
  expect(result.projection).toEqual({
    historyMessageCount: 4,
    sources: [
      { type: "history", messageIndex: 0 },
      {
        type: "runtime-context",
        snapshotIndex: 0,
        userTurn: 0,
        messageIndex: 0,
        skills: [{ id: "review", revision: "first" }],
      },
      { type: "history", messageIndex: 3 },
      {
        type: "runtime-context",
        snapshotIndex: 1,
        userTurn: 1,
        messageIndex: 3,
        skills: [{ id: "review", revision: "second" }],
      },
    ],
  });
  result.messages[0]!.content = "Modified input";
  result.projection.sources[0]!.messageIndex = 2;
  const source = result.projection.sources[1]!;
  if (source.type === "runtime-context") source.skills[0]!.revision = "modified";
  expect({ messages, snapshots, metadata }).toEqual(before);
  expect(JSON.stringify(result.projection)).not.toContain("instructions");
});

test("projection preserves repairs and rejects mismatched origins and snapshot anchors", () => {
  const messages: Message[] = [
    {
      role: "toolResult",
      toolCallId: "missing",
      toolName: "read",
      content: [{ type: "text", text: "No result provided" }],
      isError: true,
      timestamp: 1,
    },
  ];
  const metadata = {
    historyMessageCount: 1,
    sources: [{ type: "tool-repair" as const, messageIndex: 0, toolCallId: "missing" }],
  };
  expect(projectModelInput(messages, [], metadata).projection.sources).toEqual(metadata.sources);
  for (const invalid of [
    { ...metadata, sources: [] },
    { ...metadata, historyMessageCount: 0 },
    { ...metadata, historyMessageCount: 1.5 },
    { ...metadata, sources: [{ type: "history" as const, messageIndex: -1 }] },
  ]) {
    expect(() => projectModelInput(messages, [], invalid)).toThrow("Invalid model input origins");
  }
  expect(() =>
    projectModelInput(messages, [{ userTurn: 0, content: "Unanchored", timestamp: 1 }], metadata),
  ).toThrow("Invalid session runtime context");
});
