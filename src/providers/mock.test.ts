import { expect, test } from "bun:test";
import { MockProvider } from "./mock";

test("mock provider exposes a stable deterministic response", async () => {
  const provider = new MockProvider();
  expect(
    (await provider.complete({ model: "mock", messages: [{ role: "user", content: "ping" }] }))
      .text,
  ).toBe("Mock response: ping");
});
