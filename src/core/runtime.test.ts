import { expect, test } from "bun:test";
import { AgentRuntime } from "./runtime";
import { MockProvider } from "../providers/mock";

test("runs a prompt through the mock provider and emits lifecycle events", async () => {
  const events: string[] = [];
  const result = await new AgentRuntime().run("hello", {
    provider: new MockProvider(),
    model: "mock-echo",
    onEvent: (event) => events.push(event.type),
  });
  expect(result.output).toBe("Mock response: hello");
  expect(events).toEqual(["run_started", "model_response", "run_completed"]);
});
