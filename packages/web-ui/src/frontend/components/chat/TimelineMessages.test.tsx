import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionSnapshot } from "../../../shared/protocol";
import { useTimelineProjection } from "../../hooks/useTimelineProjection";
import { TimelineMessages } from "./TimelineMessages";
import "../../i18n/setup";

test("timeline rows retain absolute user keys in a detached window", async () => {
  const snapshot = {
    sessionId: "test",
    streamId: "stream",
    workspaceId: null,
    history: { start: 40, total: 200, userStart: 10 },
    model: { id: "test", name: "Test", provider: "test" },
    operation: "idle",
    tools: {},
    state: {
      messages: [{ role: "user", content: "Target", timestamp: 0 }],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  } as SessionSnapshot;
  const View = () => (
    <TimelineMessages
      snapshot={snapshot}
      projection={useTimelineProjection(snapshot)}
      start={0}
      userMessageRef={{ current: null }}
      viewport={{ current: null }}
      onTarget={() => {}}
    />
  );
  const browser = new Window();
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", browser.document);
  try {
    expect(renderToStaticMarkup(<View />)).toContain('data-row-key="test:40"');
  } finally {
    vi.unstubAllGlobals();
    await browser.happyDOM.close();
  }
});
