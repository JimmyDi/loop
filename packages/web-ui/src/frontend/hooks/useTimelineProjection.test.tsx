import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";
import { groupTimelineTurns, projectAssistantTurn } from "../components/chat/timeline-turns";
import { useTimelineProjection } from "./useTimelineProjection";

test("paged metadata uses absolute history indexes and preserves reusable indexes through drafts", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup } = await import("@testing-library/react/pure");
  const skills = [
    {
      id: "synthetic",
      name: "Example",
      path: "skills/example/SKILL.md",
      revision: "test",
      content: "Synthetic instructions",
    },
  ];
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "example",
    workspaceId: null,
    history: { start: 10, total: 12, userStart: 5 },
    operation: "prompt",
    model: { id: "test", provider: "test", name: "Test" },
    tools: {},
    state: {
      messages: [
        { role: "user", content: "Example", timestamp: 0 },
        {
          role: "toolResult",
          toolCallId: "call",
          toolName: "read",
          content: [],
          isError: false,
          timestamp: 0,
        },
      ],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      skillLoads: [{ userTurn: 5, skills }],
      promptTimings: [
        { userMessageIndex: 10, messageStartIndex: 11, messageEndIndex: 12, startedAt: 100 },
      ],
    },
  };
  try {
    const hook = renderHook(({ snapshot }) => useTimelineProjection(snapshot), {
      initialProps: { snapshot },
    });
    expect(hook.result.current.skillsByIndex.get(0)).toBe(skills);
    expect(hook.result.current.turnTimings[1]?.userMessageIndex).toBe(0);
    expect(hook.result.current.turnTimings[1]?.messageStartIndex).toBe(1);
    const index = hook.result.current.skillsByIndex;
    const completed = hook.result.current.turns;
    const timings = hook.result.current.turnTimings;
    const draft: NonNullable<SessionSnapshot["state"]["draft"]> = {
      role: "assistant",
      content: [],
      api: "openai-completions",
      provider: "test",
      model: "test",
      stopReason: "stop",
      timestamp: 0,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    hook.rerender({
      snapshot: { ...snapshot, draftIndex: 12, state: { ...snapshot.state, draft } },
    });
    expect(hook.result.current.draftIndex).toBe(2);
    expect(hook.result.current.skillsByIndex).toBe(index);
    expect(snapshot.state.messages).toHaveLength(2);
    expect(hook.result.current.turns[0]).toBe(completed[0]);
    expect(hook.result.current.turnTimings).toBe(timings);

    const separated = {
      ...snapshot,
      state: {
        ...snapshot.state,
        promptTimings: [
          ...snapshot.state.promptTimings!,
          { userMessageIndex: 10, messageStartIndex: 12, startedAt: 200 },
        ],
        draft,
      },
    };
    hook.rerender({ snapshot: separated });
    const prior = hook.result.current.turns[1]!;
    if (prior.type !== "assistant") throw new Error("Expected a completed assistant turn");
    const entries = projectAssistantTurn(prior.messages);
    expect(hook.result.current.turnTimings[2]?.startedAt).toBe(200);

    const updated = { ...draft, content: [{ type: "text" as const, text: "Streaming" }] };
    hook.rerender({ snapshot: { ...separated, state: { ...separated.state, draft: updated } } });
    expect(hook.result.current.turns[1]).toBe(prior);
    expect(projectAssistantTurn(prior.messages)).toBe(entries);
    expect(hook.result.current.turns).toEqual(
      groupTimelineTurns([...snapshot.state.messages, updated], [1, 2]),
    );
    hook.rerender({ snapshot: { ...separated, draftIndex: 11 } });
    expect(hook.result.current.turns).toEqual(
      groupTimelineTurns([snapshot.state.messages[0]!, draft], [1, 2]),
    );
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
