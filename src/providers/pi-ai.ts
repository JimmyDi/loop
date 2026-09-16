import type { ModelRequest, ModelResponse, Provider, ProviderCapabilities } from "./types";

type UnknownModule = Record<string, unknown>;

const dynamicImport = (specifier: string) =>
  Function("specifier", "return import(specifier)")(specifier) as Promise<UnknownModule>;

export class PiAiProvider implements Provider {
  readonly name = "pi-ai";

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let module: UnknownModule;
    try {
      module = await dynamicImport("@earendil-works/pi-ai");
    } catch {
      throw new Error("The optional @earendil-works/pi-ai package is not installed");
    }
    const candidate = module.complete ?? module.generateText ?? module.run;
    if (typeof candidate !== "function")
      throw new Error("@earendil-works/pi-ai has no supported completion function");
    try {
      const value = await (candidate as (input: unknown) => Promise<unknown>)({
        model: request.model,
        messages: request.messages,
        tools: request.tools,
        apiKey: process.env.PI_AI_API_KEY,
        baseUrl: process.env.PI_AI_BASE_URL || undefined,
        signal: request.signal,
      });
      const result = value as Record<string, unknown>;

      return {
        text: String(result.text ?? result.content ?? result.output ?? ""),
        toolCalls: Array.isArray(result.toolCalls)
          ? (result.toolCalls as ModelResponse["toolCalls"])
          : undefined,
        finishReason: "stop",
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  supports(_model: string, capability: keyof ProviderCapabilities) {
    return capability !== "vision";
  }

  normalizeError(error: unknown) {
    return error instanceof Error
      ? new Error(`pi-ai: ${error.message}`)
      : new Error(`pi-ai: ${String(error)}`);
  }
}
