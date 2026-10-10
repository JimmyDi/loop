import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

import { executeTool, createToolError } from "./execute-tool";
import { streamModelResponse } from "./stream-model-response";
import { validateLoopInput } from "./validate-loop-input";
import type { AgentEventListener, AgentLoopOptions, PromptContent } from "./types";

/** Sole writer of history. Callers must not mutate it until this promise settles. */
export const runAgentLoop = async (
  content: PromptContent,
  history: Message[],
  options: AgentLoopOptions,
  onEvent: AgentEventListener = () => {},
  signal: AbortSignal = new AbortController().signal,
): Promise<AssistantMessage> => {
  validateLoopInput(content, options);

  // Streamed partial messages are mutable. Listeners receive event-time snapshots.
  const emit: AgentEventListener = (event) => onEvent(structuredClone(event));

  const append = async (message: Message, started = false) => {
    history.push(structuredClone(message));

    if (!started) await emit({ type: "message_start", message });

    await emit({ type: "message_end", message });
  };

  signal.throwIfAborted();
  await append({ role: "user", content: structuredClone(content), timestamp: Date.now() });

  for (let turn = 0; ; turn++) {
    signal.throwIfAborted();

    if (options.maxTurns !== undefined && turn >= options.maxTurns)
      throw new Error("Maximum model turns reached: " + options.maxTurns);

    const message = await streamModelResponse(history, options, emit, signal);
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
      // Request normalization filters error/aborted assistants on replay; do not create orphan results for them.
      if (message.stopReason !== "error" && message.stopReason !== "aborted") {
        const skipped = calls.slice(completed).map((call) => createToolError(call, error));

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
};
