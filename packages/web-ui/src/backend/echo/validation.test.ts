import { expect, test } from "vitest";

import { validateEchoData } from "./validation";

test("corrupt members and future versions fail closed", () => {
  expect(() => validateEchoData({ version: 2, agents: [], conversations: [] })).toThrow();
  const id = crypto.randomUUID();
  expect(() =>
    validateEchoData({
      version: 1,
      agents: [],
      conversations: [{ id, name: "Chat", agentIds: [id], responderId: id }],
    }),
  ).toThrow("conversation");
});

test("avatar accepts bounded image data and rejects non-image content", () => {
  const agent = { id: crypto.randomUUID(), name: "One", instructions: "" };
  const data = {
    version: 1,
    agents: [{ ...agent, avatar: "data:image/png;base64,AAAA" }],
    conversations: [],
  };
  expect(validateEchoData(data).agents[0]?.avatar).toBe(data.agents[0]?.avatar);
  expect(() =>
    validateEchoData({ ...data, agents: [{ ...agent, avatar: "data:text/html;base64,AAAA" }] }),
  ).toThrow("Agent");
});
