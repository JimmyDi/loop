// Adapted from Pi (MIT). See THIRD_PARTY_NOTICES.md.
import { validateToolArguments } from "@earendil-works/pi-ai";
import type { AssistantMessage, Message, ToolCall, ToolResultMessage } from "@earendil-works/pi-ai";
import { transformMessages } from "@earendil-works/pi-ai/api/transform-messages";

import type { AgentEventListener, AgentLoopOptions, AgentTool } from "./types";

/** Sole writer of history. Callers must not mutate it until this promise settles. */
export async function runAgentLoop(
  text: string,
  history: Message[],
  options: AgentLoopOptions,
  onEvent: AgentEventListener = () => {},
  signal: AbortSignal = new AbortController().signal,
): Promise<AssistantMessage> {
  if (!text.trim()) throw new Error("Prompt is required");

  if (typeof options.streamFn !== "function") throw new Error("streamFn is required");

  if (
    options.maxTurns !== undefined &&
    (!Number.isSafeInteger(options.maxTurns) || options.maxTurns < 1)
  ) {
    throw new Error("maxTurns must be a positive integer");
  }

  // Pi partial messages are mutable. Listeners receive event-time snapshots.
  const emit: AgentEventListener = (event) => onEvent(structuredClone(event));

  const append = async (message: Message, started = false) => {
    history.push(structuredClone(message));

    if (!started) await emit({ type: "message_start", message });

    await emit({ type: "message_end", message });
  };

  signal.throwIfAborted();
  await append({ role: "user", content: text, timestamp: Date.now() });

  for (let turn = 0; ; turn++) {
    signal.throwIfAborted();

    if (options.maxTurns !== undefined && turn >= options.maxTurns)
      throw new Error("Maximum model turns reached: " + options.maxTurns);

    const message = await streamResponse(history, options, emit, signal);
    const calls = message.content.filter((item) => item.type === "toolCall");
    let completed = 0;

    try {
      await append(message, true);
      signal.throwIfAborted();

      if (message.stopReason !== "stop" && message.stopReason !== "toolUse") {
        throw new Error(
          message.errorMessage ??
            (message.stopReason === "length"
              ? "Model response was truncated (length)"
              : message.stopReason === "deferred"
                ? "Deferred responses are not supported"
                : "Model response ended with " + message.stopReason),
        );
      }

      if (!calls.length) return structuredClone(message);

      for (const call of calls) {
        signal.throwIfAborted();
        await emit({
          type: "tool_execution_start",
          toolCallId: call.id,
          toolName: call.name,
          args: call.arguments,
        });

        const result = await executeTool(call, options.tools ?? [], signal);

        // Commit before notifying so a failed listener cannot leave an unpaired call.
        history.push(structuredClone(result));
        completed++;

        await emit({
          type: "tool_execution_end",
          toolCallId: call.id,
          toolName: call.name,
          result,
          isError: result.isError,
        });
        await emit({ type: "message_start", message: result });
        await emit({ type: "message_end", message: result });
        signal.throwIfAborted();
      }
    } catch (error) {
      // Pi filters error/aborted assistants on replay; do not create orphan results for them.
      if (message.stopReason !== "error" && message.stopReason !== "aborted") {
        const skipped = calls.slice(completed).map((call) => toolError(call, error));

        history.push(...structuredClone(skipped));

        for (const result of skipped) {
          try {
            await emit({ type: "message_start", message: result });
            await emit({ type: "message_end", message: result });
          } catch {
            // All results are already committed. Preserve the original run failure.
          }
        }
      }

      throw error;
    }
  }
}

async function streamResponse(
  history: Message[],
  options: AgentLoopOptions,
  emit: AgentEventListener,
  signal: AbortSignal,
): Promise<AssistantMessage> {
  signal.throwIfAborted();

  // Pi AI 0.85.1 uses Context, not TranscriptContext/normalizeContext (added later).
  const context = {
    systemPrompt: options.systemPrompt,
    messages: transformMessages(structuredClone(history), options.model),
    tools: options.tools?.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    })),
  };

  const stream = await abortable(
    Promise.resolve(options.streamFn(options.model, context, { ...options.streamOptions, signal })),
    signal,
  );

  const iterator = stream[Symbol.asyncIterator]();
  let started = false;
  let ended = false;

  try {
    while (true) {
      const next = await abortable(iterator.next(), signal);

      if (next.done) break;

      const event = next.value;

      if (event.type === "start") {
        started = true;
        await emit({ type: "message_start", message: event.partial });
      } else if (event.type === "done" || event.type === "error") {
        ended = true;
      } else {
        if (!started) throw new Error("Model stream updated before start");

        await emit({
          type: "message_update",
          message: event.partial,
          assistantMessageEvent: event,
        });
      }
    }

    if (!ended) throw new Error("Model stream ended without a final response");

    const message = structuredClone(await abortable(stream.result(), signal));

    if (!started) await emit({ type: "message_start", message });

    return message;
  } finally {
    void iterator.return?.().catch(() => {});
  }
}

async function executeTool(
  call: ToolCall,
  tools: readonly AgentTool[],
  signal: AbortSignal,
): Promise<ToolResultMessage> {
  try {
    signal.throwIfAborted();

    const tool = tools.find((item) => item.name === call.name);

    if (!tool) throw new Error("Tool not found: " + call.name);

    const parameters = validateToolArguments(tool, call);

    signal.throwIfAborted();

    const content = await tool.execute(parameters, signal);

    signal.throwIfAborted();

    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: call.name,
      content,
      isError: false,
      timestamp: Date.now(),
    };
  } catch (error) {
    return toolError(call, signal.aborted ? signal.reason : error);
  }
}

function toolError(call: ToolCall, error: unknown): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
    timestamp: Date.now(),
  };
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Run cancelled"));

    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });

    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
