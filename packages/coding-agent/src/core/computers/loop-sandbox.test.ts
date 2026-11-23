import { expect, test, vi } from "vitest";

import { LoopSandboxProvider } from "./loop-sandbox";

test("computer transport carries host identity and never retries uncertain delivery", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ status: "succeeded", result: {} }));
  vi.stubGlobal("fetch", fetch);
  try {
    const client = new LoopSandboxProvider("https://computer.example/", "synthetic-token");
    const body = {
      request_id: "request",
      generation: 2,
      actor: { conversation_id: "chat", agent_id: "agent", execution_id: "run" },
      name: "exec",
      arguments: { command: "true" },
    };
    await client.execute("computer", body, new AbortController().signal);
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://computer.example/echo/computers/computer/operations",
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual(body);
    expect(fetch.mock.calls[0]![1].redirect).toBe("error");
    fetch.mockRejectedValue(new Error("synthetic failure"));
    await expect(client.execute("computer", body, new AbortController().signal)).rejects.toThrow(
      "No retry",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(() => new LoopSandboxProvider("https://user:password@computer.example", "")).toThrow();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("destroy calls the persistent computer endpoint without deleting retained files", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ state: "destroyed" }));
  vi.stubGlobal("fetch", fetch);
  try {
    await new LoopSandboxProvider("https://computer.example", "synthetic-token").destroy(
      "computer",
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![0]).toBe("https://computer.example/echo/computers/computer");
    expect(fetch.mock.calls[0]![1].method).toBe("DELETE");
  } finally {
    vi.unstubAllGlobals();
  }
});
