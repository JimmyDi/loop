import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { VoiceNarrationTracker } from "./voice-narration-tracker";

test("loading earlier history never narrates old replies or changes completed reply identity", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: "assistant",
    content: [{ type: "text", text: "Reply " + index }],
    stopReason: "stop",
    timestamp: index,
  }));
  const snapshot = {
    state: { messages: messages.slice(10) },
    tools: {},
    history: { start: 10, total: 12, userStart: 0 },
  } as unknown as SessionSnapshot;
  const tracker = new VoiceNarrationTracker();
  tracker.reset(snapshot);
  const expanded = {
    ...snapshot,
    state: { messages },
    history: { start: 0, total: 12, userStart: 0 },
  } as unknown as SessionSnapshot;
  expect(tracker.next(expanded)).toEqual([]);
  const next = {
    ...expanded,
    state: { messages: [...messages, { ...messages[0], timestamp: 13 }] },
    history: { start: 0, total: 13, userStart: 0 },
  } as unknown as SessionSnapshot;
  expect(tracker.next(next).map((row) => row.id)).toEqual(["reply:12:13:0"]);
  expect(tracker.next(next)).toEqual([]);
});

test("speaks completed streaming sentences before message completion without repeating them", () => {
  const snapshot = {
    state: {
      messages: [],
      draft: {
        role: "assistant",
        timestamp: 10,
        content: [{ type: "text", text: "第一句。还没写完" }],
      },
    },
    tools: {},
  } as unknown as SessionSnapshot;
  const tracker = new VoiceNarrationTracker();
  expect(tracker.next(snapshot).map((row) => row.text)).toEqual(["第一句。"]);
  snapshot.state.draft!.content = [{ type: "text", text: "第一句。第二句！最后部分" }];
  expect(tracker.next(snapshot).map((row) => row.text)).toEqual(["第二句！"]);
  snapshot.state.messages = [{ ...snapshot.state.draft!, stopReason: "stop" }];
  snapshot.state.draft = undefined;
  expect(tracker.next(snapshot).map((row) => row.text)).toEqual(["最后部分"]);
  expect(tracker.next(snapshot)).toEqual([]);
});
