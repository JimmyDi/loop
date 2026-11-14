import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../../shared/protocol";
import type { TurnMessage } from "./timeline-turns";
import { groupTimelineTurns, projectAssistantTurn } from "./timeline-turns";
import { plansForTimelineEntry } from "./timeline-plans";

test("anchors each revision to its own successful submission and supports result-only history pages", () => {
  const plans: NonNullable<SessionSnapshot["state"]["planning"]>["plans"] = [
    { id: "first", version: 1, title: "First", markdown: "Original", status: "superseded" },
    { id: "second", version: 2, title: "Second", markdown: "Revised", status: "ready" },
  ];
  const submission = (id: string, index: number): TurnMessage[] => [
    {
      index,
      message: {
        role: "assistant",
        api: "test",
        provider: "test",
        model: "test",
        timestamp: 0,
        content: [{ type: "toolCall", id: "call-" + id, name: "submit_plan", arguments: {} }],
        stopReason: "toolUse",
      } as TurnMessage["message"],
    },
    {
      index: index + 1,
      message: {
        role: "toolResult",
        toolCallId: "call-" + id,
        toolName: "submit_plan",
        content: [{ type: "text", text: JSON.stringify({ id }) }],
        isError: false,
        timestamp: 0,
      },
    },
  ];
  const first = submission("first", 1);
  const second = submission("second", 4);
  const turns = groupTimelineTurns([
    { role: "user", content: "Plan a change", timestamp: 0 },
    ...first.map((entry) => entry.message),
    { role: "user", content: "Adjust the approach", timestamp: 0 },
    ...second.map((entry) => entry.message),
  ]);
  const anchored = turns.flatMap((turn) =>
    turn.type === "assistant"
      ? projectAssistantTurn(turn.messages).map((entry) => ({
          index: entry.index,
          ids: plansForTimelineEntry(entry, turn.messages, plans).map((plan) => plan.id),
        }))
      : [],
  );
  expect(anchored).toEqual([
    { index: 1, ids: ["first"] },
    { index: 4, ids: ["second"] },
  ]);
  expect(plansForTimelineEntry(second[1]!, [second[1]!], plans)).toEqual([plans[1]]);
  const failed = {
    ...second[1]!,
    message: { ...second[1]!.message, isError: true },
  } as TurnMessage;
  expect(plansForTimelineEntry(failed, [failed], plans)).toEqual([]);
  const malformed = {
    ...second[1]!,
    message: { ...second[1]!.message, content: [{ type: "text", text: "not a plan" }] },
  } as TurnMessage;
  expect(plansForTimelineEntry(malformed, [malformed], plans)).toEqual([]);
});
