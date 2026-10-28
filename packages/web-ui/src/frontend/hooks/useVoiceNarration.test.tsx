// @vitest-environment happy-dom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import type { VoiceControl } from "./voice-hook-types";
import { useVoiceNarration } from "./useVoiceNarration";
import "../i18n/setup";

afterEach(cleanup);

test("retains replies received while connecting and reads every segment only once", () => {
  const voice = {
    mode: "conversation",
    status: "connecting",
    readingPaused: false,
    speak: vi.fn(),
  } as unknown as VoiceControl;
  const snapshot = {
    state: {
      messages: [
        {
          role: "assistant",
          timestamp: 1,
          stopReason: "stop",
          content: [{ type: "text", text: "一。二。三。四。五。" }],
        },
      ],
    },
    tools: {},
  } as unknown as SessionSnapshot;
  const hook = renderHook(() => useVoiceNarration(snapshot, voice));
  expect(voice.speak).not.toHaveBeenCalled();
  voice.status = "listening";
  hook.rerender();
  expect(vi.mocked(voice.speak).mock.calls.map(([text]) => text)).toEqual([
    "一。",
    "二。",
    "三。",
    "四。",
    "五。",
  ]);
  voice.status = "speaking";
  hook.rerender();
  expect(voice.speak).toHaveBeenCalledTimes(5);
});
