import { expect, test } from "bun:test";
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";
import type { AssistantMessage, AssistantMessageEvent, Context } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";

import { Agent } from "./agent";
import type { AgentEvent, AgentTool } from "./types";

const model = getModel("anthropic", "claude-opus-4-5");

function answer(stopReason: AssistantMessage["stopReason"] = "stop"): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
    model: model.id,
    provider: model.provider,
    api: model.api,
    stopReason,
    timestamp: 1,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function stream(message = answer()) {
  const result = createAssistantMessageEventStream();

  result.push({ type: "start", partial: message });

  if (message.stopReason === "error" || message.stopReason === "aborted")
    result.push({ type: "error", reason: message.stopReason, error: message });
  else result.push({ type: "done", reason: message.stopReason as "stop", message });

  result.end();

  return result;
}

test("multiple prompts retain isolated completed history without duplicating system prompt or tools", async () => {
  const contexts: Context[] = [];
  const events: AgentEvent[] = [];
  const agent = new Agent({
    model,
    systemPrompt: "system",
    tools: [{ name: "echo", description: "echo", parameters: Type.Object({}), execute: () => [] }],
    streamFn: (_model, context) => {
      contexts.push(structuredClone(context));

      return stream();
    },
  });
  const unsubscribe = agent.subscribe((event) => {
    events.push(event);
  });
  const first = await agent.prompt("first");

  agent.messages.splice(0);
  first.content.length = 0;
  unsubscribe();

  const count = events.length;

  await agent.prompt("second");

  expect(agent.messages).toHaveLength(4);
  expect(agent.messages[1]).toMatchObject({ content: [{ type: "text", text: "hello" }] });
  expect(contexts.map((context) => context.messages.length)).toEqual([1, 3]);
  expect(
    contexts.every((context) => context.systemPrompt === "system" && context.tools?.length === 1),
  ).toBe(true);
  expect(events).toHaveLength(count);
  expect(agent.isRunning).toBe(false);
});

test("streamed drafts never enter history and native update snapshots survive mutation", async () => {
  const response = createAssistantMessageEventStream();
  const partial = answer("pending");

  partial.content = [{ type: "text", text: "" }];

  const agent = new Agent({ model, streamFn: () => response });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const updates: AssistantMessageEvent[] = [];

  agent.subscribe((event) => {
    if (event.type === "message_start" && event.message.role === "assistant") started();

    if (event.type === "message_update") {
      expect(agent.messages).toHaveLength(1);

      updates.push(event.assistantMessageEvent);
    }
  });

  const running = agent.prompt("hello");

  response.push({ type: "start", partial });
  await ready;

  expect(agent.messages.map((item) => item.role)).toEqual(["user"]);

  response.push({ type: "text_delta", contentIndex: 0, delta: "hello", partial });

  const final = answer();

  response.push({ type: "done", reason: "stop", message: final });

  expect(await running).toEqual(final);

  partial.content = [];

  expect(updates[0]).toMatchObject({
    type: "text_delta",
    delta: "hello",
    partial: { content: [{ type: "text", text: "" }] },
  });
  expect(agent.messages).toHaveLength(2);
});

test.each(["error", "aborted", "length", "deferred"] as const)(
  "cleans up after %s and normalizes the next request",
  async (reason) => {
    let requests = 0;
    const agent = new Agent({
      model,
      streamFn: (_model, context) => {
        if (++requests === 1) return stream(answer(reason));

        if (reason === "error" || reason === "aborted")
          expect(context.messages.every((item) => item.role !== "assistant")).toBe(true);

        return stream();
      },
    });

    await expect(agent.prompt("first")).rejects.toThrow();
    expect(agent.isRunning).toBe(false);
    await expect(agent.prompt("second")).resolves.toMatchObject({ stopReason: "stop" });
    expect(requests).toBe(2);
  },
);

test("rejects concurrent prompts, aborts a stalled stream and starts a fresh run", async () => {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let requestSignal: AbortSignal | undefined;
  let requests = 0;
  const agent = new Agent({
    model,
    streamFn: (_model, _context, options) => {
      requestSignal = options?.signal;
      started();

      return ++requests === 1 ? createAssistantMessageEventStream() : stream();
    },
  });
  const running = agent.prompt("wait");
  const rejected = running.catch((error: Error) => error.message);

  await ready;

  expect(agent.isRunning).toBe(true);
  await expect(agent.prompt("concurrent")).rejects.toThrow("already running");

  agent.abort();

  expect(await rejected).toBe("Run cancelled");
  expect(requestSignal?.aborted).toBe(true);
  expect(agent.isRunning).toBe(false);

  await agent.prompt("next");

  expect(requestSignal?.aborted).toBe(false);
  expect(agent.messages.filter((item) => item.role === "user")).toHaveLength(2);
});

test("cancellation interrupts acquisition of a stream object", async () => {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const agent = new Agent({
    model,
    streamFn: () => {
      started();

      return new Promise(() => {});
    },
  });
  const running = agent.prompt("wait");
  const rejected = running.catch((error: Error) => error.message);

  await ready;
  agent.abort();

  expect(await rejected).toBe("Run cancelled");
  expect(agent.isRunning).toBe(false);
});

test.each(["before", "during"] as const)(
  "cancels %s a tool batch, pairs skipped calls and resumes without executing them",
  async (when) => {
    let requests = 0;
    let executions = 0;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let toolSignal: AbortSignal | undefined;
    const tools: AgentTool[] = [
      {
        name: "wait",
        description: "wait",
        parameters: Type.Object({}),
        execute: (_args, signal) => {
          executions++;
          toolSignal = signal;
          started();

          return new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
          );
        },
      },
    ];
    const calls = answer("toolUse");

    calls.content = ["a", "b"].map((id) => ({ type: "toolCall", id, name: "wait", arguments: {} }));

    const agent = new Agent({
      model,
      tools,
      streamFn: (_model, context) => {
        if (++requests === 1) return stream(calls);

        const results = context.messages.filter((item) => item.role === "toolResult");

        expect(results.map((item) => [item.toolCallId, item.toolName, item.isError])).toEqual([
          ["a", "wait", true],
          ["b", "wait", true],
        ]);

        return stream();
      },
    });

    agent.subscribe((event) => {
      if (
        when === "before" &&
        requests === 1 &&
        event.type === "message_end" &&
        event.message.role === "assistant"
      )
        agent.abort();
    });

    const running = agent.prompt("tools");
    const rejected = running.catch((error: Error) => error.message);

    if (when === "during") {
      await ready;
      agent.abort();
    }

    expect(await rejected).toBe("Run cancelled");
    expect(requests).toBe(1);
    expect(executions).toBe(when === "during" ? 1 : 0);

    if (when === "during") expect(toolSignal?.aborted).toBe(true);

    expect(agent.isRunning).toBe(false);

    await agent.prompt("next");

    expect(requests).toBe(2);
  },
);

test("unexpected failures and invalid input release the agent", async () => {
  let requests = 0;
  const agent = new Agent({
    model,
    streamFn: () => {
      if (++requests === 1) throw new Error("request failure");

      return stream();
    },
  });

  await expect(agent.prompt(" ")).rejects.toThrow("Prompt is required");
  expect(agent.isRunning).toBe(false);
  expect(agent.messages).toEqual([]);
  await expect(agent.prompt("first")).rejects.toThrow("request failure");
  expect(agent.isRunning).toBe(false);

  await agent.prompt("next");

  expect(requests).toBe(2);
});
