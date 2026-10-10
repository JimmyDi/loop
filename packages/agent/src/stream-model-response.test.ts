import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { expect, test, vi } from "vitest";

import { streamModelResponse } from "./stream-model-response";
import type { AgentEvent, AgentLoopOptions } from "./types";

const model = getModel("anthropic", "claude-opus-4-5");

const answer = (): AssistantMessage => ({
  role: "assistant",
  api: model.api,
  provider: model.provider,
  model: model.id,
  content: [{ type: "text", text: "done" }],
  stopReason: "stop",
  timestamp: 1,
  usage: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("dispatch carries raw origins, excludes execution functions and reads the same final result once", async () => {
  const failed: AssistantMessage = { ...answer(), stopReason: "error" };
  const history: Message[] = [
    { role: "user", content: "First", timestamp: 1 },
    failed,
    { role: "user", content: "Continue", timestamp: 2 },
  ];
  const before = structuredClone(history);
  const signal = new AbortController().signal;
  const stream = createAssistantMessageEventStream();
  const final = answer();
  stream.push({ type: "done", reason: "stop", message: final });
  stream.end();
  const result = vi.spyOn(stream, "result");
  const events: AgentEvent[] = [];
  const options: AgentLoopOptions = {
    model,
    systemPrompt: "Test",
    streamOptions: { maxTokens: 64 },
    tools: [
      {
        name: "echo",
        description: "Echo",
        parameters: { type: "object" },
        execute: () => [],
      },
    ],
    streamFn: (_model, context, settings, metadata) => {
      expect(context.messages).toEqual([history[0], history[2]]);
      expect(context.systemPrompt).toBe("Test");
      expect(context.tools).toEqual([
        { name: "echo", description: "Echo", parameters: { type: "object" } },
      ]);
      expect(settings).toEqual({ maxTokens: 64, signal });
      expect(metadata).toEqual({
        historyMessageCount: 3,
        sources: [
          { type: "history", messageIndex: 0 },
          { type: "history", messageIndex: 2 },
        ],
      });
      context.messages[0]!.content = "Changed request";
      return stream;
    },
  };
  expect(
    await streamModelResponse(
      history,
      options,
      (event) => {
        events.push(event);
      },
      signal,
    ),
  ).toEqual(final);
  expect(result).toHaveBeenCalledTimes(1);
  expect(events).toEqual([{ type: "message_start", message: final }]);
  expect(history).toEqual(before);
});

test("cancellation closes the iterator while waiting for another model event", async () => {
  const controller = new AbortController();
  const stream = createAssistantMessageEventStream();
  const iterator = stream[Symbol.asyncIterator]();
  const closed = vi.spyOn(iterator, "return");
  stream[Symbol.asyncIterator] = () => iterator;
  const started = Promise.withResolvers<void>();
  stream.push({ type: "start", partial: answer() });
  const pending = streamModelResponse(
    [],
    { model, streamFn: () => stream },
    () => {
      started.resolve();
    },
    controller.signal,
  );
  const reason = new Error("Run cancelled");
  const rejected = expect(pending).rejects.toBe(reason);
  await started.promise;
  controller.abort(reason);
  await rejected;
  expect(closed).toHaveBeenCalledTimes(1);
  stream.end();
});
