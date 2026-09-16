import type { Message } from "../providers/types";
import { capabilityFor, requiresApproval, validateCapabilities } from "../permissions/policy";
import type { RuntimeOptions, RunEvent } from "./types";

const emit = (options: RuntimeOptions, event: RunEvent) => options.onEvent?.(event);

export class AgentRuntime {
  async run(prompt: string, options: RuntimeOptions) {
    const runId = crypto.randomUUID();
    const messages: Message[] = [{ role: "user", content: prompt }];
    const maxSteps = options.maxSteps ?? 8;
    emit(options, { type: "run_started", runId, prompt });
    try {
      for (let step = 0; step < maxSteps; step += 1) {
        options.signal?.throwIfAborted();
        const tools = options.registry?.listTools() ?? [];

        const response = await options.provider.complete({
          model: options.model,
          messages,
          tools: tools.map(({ execute: _execute, ...definition }) => definition),
          signal: options.signal,
        });
        emit(options, { type: "model_response", text: response.text });

        if (!response.toolCalls?.length) {
          emit(options, { type: "run_completed", output: response.text });
          return { runId, output: response.text };
        }
        messages.push({ role: "assistant", content: response.text });

        for (const call of response.toolCalls) {
          const tool = options.registry?.getTool(call.name);
          if (!tool) throw new Error(`Unknown tool: ${call.name}`);
          validateCapabilities(tool, options.policy);

          if (requiresApproval(tool, options.policy)) {
            emit(options, {
              type: "approval_required",
              name: tool.name,
              capabilities: capabilityFor(tool),
            });
            throw new Error(`Approval required for tool: ${tool.name}`);
          }
          emit(options, { type: "tool_started", name: call.name, input: call.input });
          const result = await tool.execute(call.input);
          const output = typeof result === "string" ? result : JSON.stringify(result);
          emit(options, { type: "tool_finished", name: call.name, output });
          messages.push({ role: "tool", content: output });
        }
      }
      throw new Error(`Agent exceeded ${maxSteps} steps`);
    } catch (error) {
      const normalized = options.provider.normalizeError(error);
      emit(options, { type: "run_failed", error: normalized.message });
      throw normalized;
    }
  }
}
