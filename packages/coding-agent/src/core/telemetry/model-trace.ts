import type { AssistantMessageEvent, AssistantMessageEventStream } from "@earendil-works/pi-ai";

import type { StreamFn } from "@loop/agent";
import type { ModelRuntime } from "../model-runtime";
import type { SessionTrace } from "./session-trace";
import type { ModelTraceResult } from "./trace-schema";

/** Tap the existing consumer; no additional reader, provider or synthetic stream. */
export const traceModelRuntime = (
  runtime: ModelRuntime,
  trace: SessionTrace,
  purpose = "main",
): ModelRuntime => {
  if (!trace.enabled) return runtime;
  return {
    getModel: runtime.getModel.bind(runtime),
    getModels: runtime.getModels.bind(runtime),
    checkModel: runtime.checkModel.bind(runtime),
    forPurpose: (next) => traceModelRuntime(runtime, trace, next),
    streamSimple: ((model, context, options, metadata) => {
      if (!trace.enabled) return runtime.streamSimple(model, context, options, metadata);
      const runId = trace.runId;
      const parentId = purpose === "compaction" ? trace.modelParentId : runId;
      const id = trace.begin(
        "model.request",
        {
          purpose,
          model: { provider: model.provider, id: model.id, api: model.api },
          options: {
            maxTokens: options?.maxTokens,
            reasoning: options?.reasoning,
            temperature: options?.temperature,
          },
          context: trace.mode === "metadata" ? undefined : context,
        },
        parentId,
      );
      let ended = false;
      const started = performance.now();
      const finish = (data: ModelTraceResult) => {
        if (ended) return;
        ended = true;
        options?.signal?.removeEventListener("abort", abort);
        trace.record(
          "model.request.completed",
          { purpose, durationMs: performance.now() - started, result: data },
          id,
          parentId,
          runId ?? null,
        );
      };
      const abort = () => finish({ outcome: "cancelled" });
      options?.signal?.addEventListener("abort", abort, { once: true });
      if (options?.signal?.aborted) abort();
      const observe = (event: AssistantMessageEvent) => {
        if (event.type === "done" || event.type === "error") {
          const message = event.type === "done" ? event.message : event.error;
          finish(
            trace.mode === "metadata"
              ? {
                  stopReason: message.stopReason,
                  usage: message.usage,
                  errorMessage: message.errorMessage,
                }
              : message,
          );
        } else if (trace.mode === "stream") {
          const { partial: _partial, ...delta } = event;
          trace.record("model.stream.received", delta, id, runId, runId ?? null);
        }
      };
      const wrap = (stream: AssistantMessageEventStream) =>
        new Proxy(stream, {
          get(target, property) {
            if (property === Symbol.asyncIterator)
              return () => {
                const iterator = target[Symbol.asyncIterator]();
                return {
                  next: async () => {
                    try {
                      const next = await iterator.next();
                      if (next.done) {
                        if (!ended) finish({ outcome: "incomplete" });
                      } else observe(next.value);
                      return next;
                    } catch (error) {
                      finish({ outcome: "error", error: String(error) });
                      throw error;
                    }
                  },
                  return: async () => {
                    if (!ended) finish({ outcome: "interrupted" });
                    return iterator.return ? iterator.return() : { done: true, value: undefined };
                  },
                };
              };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      try {
        const stream = runtime.streamSimple(model, context, options, metadata);
        return stream instanceof Promise
          ? stream.then(wrap, (error) => {
              finish({ outcome: "error", error: String(error) });
              throw error;
            })
          : wrap(stream);
      } catch (error) {
        finish({ outcome: "error", error: String(error) });
        throw error;
      }
    }) satisfies StreamFn,
  };
};
