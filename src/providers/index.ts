import { MockProvider } from "./mock";
import { PiAiProvider } from "./pi-ai";
import type { Provider } from "./types";

export const createProvider = (name = process.env.LOOP_PROVIDER ?? "mock"): Provider => {
  if (name === "mock") return new MockProvider();
  if (name === "pi-ai") return new PiAiProvider();
  throw new Error(`Unknown provider: ${name}`);
};

export type {
  Provider,
  ModelRequest,
  ModelResponse,
  Message,
  ToolCall,
  ToolDefinition,
} from "./types";
