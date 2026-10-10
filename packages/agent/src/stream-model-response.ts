import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

import { abortable } from "./abortable-promise";
import { normalizeModelInput } from "./normalize-model-input";
import type { AgentEventListener, AgentLoopOptions } from "./types";

export const streamModelResponse = async (
  history: Message[],
  options: AgentLoopOptions,
  emit: AgentEventListener,
  signal: AbortSignal,
): Promise<AssistantMessage> => {
  signal.throwIfAborted();

  const input = normalizeModelInput(history, options.model);
  const context = {
    systemPrompt: options.systemPrompt,
    messages: input.messages,
    tools: options.tools?.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    })),
  };

  const stream = await abortable(
    Promise.resolve(
      options.streamFn(
        options.model,
        context,
        { ...options.streamOptions, signal },
        { historyMessageCount: history.length, sources: input.sources },
      ),
    ),
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
};
