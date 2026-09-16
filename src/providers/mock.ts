import type { ModelRequest, ModelResponse, Provider, ProviderCapabilities } from "./types";

export class MockProvider implements Provider {
  readonly name = "mock";
  readonly calls: ModelRequest[] = [];

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.calls.push(request);
    const latest = [...request.messages].reverse().find((message) => message.role === "user");
    return { text: `Mock response: ${latest?.content ?? ""}`, finishReason: "stop" };
  }

  supports(_model: string, capability: keyof ProviderCapabilities) {
    return capability === "json";
  }

  normalizeError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
