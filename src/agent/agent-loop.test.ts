import { expect, test } from "bun:test";
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Message, ToolCall } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";

import { runAgentLoop } from "./agent-loop";
import type { AgentEvent, AgentTool, StreamFn } from "./types";

const model = getModel("anthropic", "claude-opus-4-5");

function answer(
  calls: ToolCall[] = [],
  stopReason: AssistantMessage["stopReason"] = calls.length ? "toolUse" : "stop",
): AssistantMessage {
  return {
    role: "assistant",
    content: calls.length ? calls : [{ type: "text", text: "answer" }],
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

function call(id: string, name = "echo", args: Record<string, unknown> = { text: id }): ToolCall {
  return { type: "toolCall", id, name, arguments: args };
}

function stream(message: AssistantMessage) {
  const result = createAssistantMessageEventStream();

  result.push({ type: "start", partial: message });

  if (message.stopReason === "error" || message.stopReason === "aborted")
    result.push({ type: "error", reason: message.stopReason, error: message });
  else result.push({ type: "done", reason: message.stopReason as "stop", message });

  result.end();

  return result;
}

function tool(execute: AgentTool["execute"]): AgentTool {
  return {
    name: "echo",
    description: "Echo text",
    parameters: Type.Object({ text: Type.String() }),
    execute,
  };
}

test("reads the same stream's result once and appends one completed answer", async () => {
  const history: Message[] = [];
  const events: AgentEvent[] = [];
  const final = answer();
  const response = stream(final);
  let reads = 0;
  const result = response.result.bind(response);

  response.result = () => {
    reads++;

    return result();
  };

  let requests = 0;
  const output = await runAgentLoop(
    "hello",
    history,
    {
      model,
      streamFn: async () => {
        requests++;

        return response;
      },
    },
    (event) => {
      events.push(event);
    },
  );

  expect(output).toEqual(final);
  expect(reads).toBe(1);
  expect(requests).toBe(1);
  expect(history).toEqual([
    { role: "user", content: "hello", timestamp: expect.any(Number) },
    final,
  ]);
  expect(events.map((event) => event.type)).toEqual([
    "message_start",
    "message_end",
    "message_start",
    "message_end",
  ]);
});

test("executes a batch sequentially and sends matching results on the next model turn", async () => {
  const contexts: Context[] = [];
  const order: string[] = [];
  const events: AgentEvent[] = [];
  let running = false;
  const tools = [
    tool(async (args, signal) => {
      expect(running).toBe(false);
      expect(signal.aborted).toBe(false);

      running = true;
      order.push(String(args.text));
      await Promise.resolve();
      running = false;

      return [{ type: "text", text: String(args.text) }];
    }),
  ];
  const history: Message[] = [];

  await runAgentLoop(
    "do both",
    history,
    {
      model,
      tools,
      systemPrompt: "system",
      streamFn: (_model, context) => {
        contexts.push(structuredClone(context));

        return stream(contexts.length === 1 ? answer([call("a"), call("b")]) : answer());
      },
    },
    (event) => {
      events.push(event);
    },
  );

  expect(order).toEqual(["a", "b"]);
  expect(contexts).toHaveLength(2);
  expect(contexts[1].messages.map((item) => item.role)).toEqual([
    "user",
    "assistant",
    "toolResult",
    "toolResult",
  ]);
  expect(contexts[1].messages.slice(2)).toMatchObject([
    { toolCallId: "a", toolName: "echo", isError: false, content: [{ type: "text", text: "a" }] },
    { toolCallId: "b", toolName: "echo", isError: false, content: [{ type: "text", text: "b" }] },
  ]);
  expect(contexts[1].tools).toEqual([
    { name: "echo", description: "Echo text", parameters: tools[0].parameters },
  ]);
  expect(history).toHaveLength(5);
  expect(
    events.filter((event) => event.type.startsWith("tool_execution")).map((event) => event.type),
  ).toEqual([
    "tool_execution_start",
    "tool_execution_end",
    "tool_execution_start",
    "tool_execution_end",
  ]);
});

test("missing tools, invalid arguments and thrown tool errors become model-visible error results", async () => {
  let executions = 0;
  let requests = 0;

  await runAgentLoop("try tools", [], {
    model,
    tools: [
      tool(() => {
        executions++;

        throw new Error("tool failed");
      }),
    ],
    streamFn: (_model, context) => {
      if (++requests === 1)
        return stream(
          answer([call("missing", "unknown"), call("invalid", "echo", {}), call("throws")]),
        );

      const results = context.messages.filter((item) => item.role === "toolResult");

      expect(results.map((item) => [item.toolCallId, item.toolName, item.isError])).toEqual([
        ["missing", "unknown", true],
        ["invalid", "echo", true],
        ["throws", "echo", true],
      ]);
      expect(JSON.stringify(results)).toContain("Tool not found");
      expect(JSON.stringify(results)).toContain("Validation failed");
      expect(JSON.stringify(results)).toContain("tool failed");

      return stream(answer());
    },
  });

  expect(executions).toBe(1);
  expect(requests).toBe(2);
});

test("passes Pi-validated/coerced parameters to tools and preserves image content", async () => {
  const history: Message[] = [];
  let requests = 0;

  await runAgentLoop("number", history, {
    model,
    tools: [
      {
        name: "number",
        description: "number",
        parameters: Type.Object({ value: Type.Number() }),
        execute: (args) => {
          expect(args.value).toBe(12);

          return [{ type: "image", data: "example", mimeType: "image/png" }];
        },
      },
    ],
    streamFn: () =>
      stream(++requests === 1 ? answer([call("n", "number", { value: "12" })]) : answer()),
  });

  expect(history[2]).toMatchObject({
    isError: false,
    content: [{ type: "image", data: "example", mimeType: "image/png" }],
  });
});

test.each(["error", "aborted", "length", "deferred", "pending"] as const)(
  "rejects %s without executing tools or continuing",
  async (reason) => {
    let requests = 0;
    let executed = false;
    const history: Message[] = [];

    await expect(
      runAgentLoop("hello", history, {
        model,
        tools: [
          tool(() => {
            executed = true;

            return [];
          }),
        ],
        streamFn: () => {
          requests++;

          return stream(answer([call("a")], reason));
        },
      }),
    ).rejects.toThrow();
    expect(requests).toBe(1);
    expect(executed).toBe(false);
    expect(history[1]).toMatchObject({ stopReason: reason });
  },
);

test("maxTurns counts model requests, finishes results, then rejects instead of returning success", async () => {
  let requests = 0;
  let executions = 0;
  const history: Message[] = [];

  await expect(
    runAgentLoop("repeat", history, {
      model,
      maxTurns: 2,
      tools: [
        tool(() => {
          executions++;

          return [];
        }),
      ],
      streamFn: () => stream(answer([call(String(++requests))])),
    }),
  ).rejects.toThrow("Maximum model turns reached: 2");
  expect(requests).toBe(2);
  expect(executions).toBe(2);
  expect(history.at(-1)).toMatchObject({ role: "toolResult", toolCallId: "2" });
});

test.each([0, -1, 1.5, Infinity, NaN])(
  "rejects invalid maxTurns %s before recording input",
  async (maxTurns) => {
    const history: Message[] = [];

    await expect(
      runAgentLoop("hello", history, { model, maxTurns, streamFn: () => stream(answer()) }),
    ).rejects.toThrow("positive integer");
    expect(history).toEqual([]);
  },
);

test("a failed event listener cannot leave unpaired tool calls", async () => {
  const history: Message[] = [];
  let executions = 0;

  await expect(
    runAgentLoop(
      "hello",
      history,
      {
        model,
        tools: [
          tool(() => {
            executions++;

            return [];
          }),
        ],
        streamFn: () => stream(answer([call("a"), call("b")])),
      },
      (event) => {
        if (event.type === "tool_execution_end") throw new Error("listener failed");
      },
    ),
  ).rejects.toThrow("listener failed");
  expect(executions).toBe(1);
  expect(
    history.filter((item) => item.role === "toolResult").map((item) => item.toolCallId),
  ).toEqual(["a", "b"]);
});

test("rejects incomplete streams and unexpected stream-function failures", async () => {
  const incomplete = createAssistantMessageEventStream();

  incomplete.end();

  await expect(runAgentLoop("hello", [], { model, streamFn: () => incomplete })).rejects.toThrow(
    "without a final response",
  );

  const streamFn: StreamFn = async () => {
    throw new Error("request failed");
  };

  await expect(runAgentLoop("hello", [], { model, streamFn })).rejects.toThrow("request failed");
});
