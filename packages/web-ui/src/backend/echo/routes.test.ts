import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { EchoStore } from "./store";
import { echoRoutes } from "./routes";
import type { SessionRegistry } from "../session-registry";

test("Echo routes create independent conversations and validate membership before switching", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-echo-routes-"));
  try {
    const store = new EchoStore(directory);
    const registry = {
      unload: vi.fn(),
      configure: async (action: () => Promise<void>) => action(),
    } as unknown as SessionRegistry;
    const route = echoRoutes(store, registry);
    const call = async (path: string, body?: unknown, method = "POST") => {
      const request = new Request("http://localhost/api/echo" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return route(request, new URL(request.url));
    };
    const first = await (await call("/agents", {
      name: "One",
      instructions: "Help with research",
    }))!.json();
    const second = await (await call("/agents", {
      name: "Two",
      instructions: "Help with review",
    }))!.json();
    const chat = await (await call("/conversations", {
      name: "Group",
      agentIds: [first.id, second.id],
    }))!.json();
    await call("/conversations/" + chat.id, { responderId: second.id }, "PUT");
    expect((await new EchoStore(directory).read()).conversations[0]?.responderId).toBe(second.id);
    await expect(
      call("/conversations/" + chat.id, { responderId: "outside" }, "PUT"),
    ).rejects.toThrow("invalid_responder");
    await call(
      "/connection",
      {
        provider: "loop-sandbox",
        endpoint: "https://computer.example",
        token: "synthetic-token",
        desktop: true,
      },
      "PUT",
    );
    expect(JSON.stringify(await (await call("", undefined, "GET"))!.json())).not.toContain(
      "synthetic-token",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("deleting a computer clears every conversation binding while retaining files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-echo-delete-"));
  const computerId = "a".repeat(32);
  const otherId = "b".repeat(32);
  const agentId = crypto.randomUUID();
  const firstId = crypto.randomUUID();
  const secondId = crypto.randomUUID();
  const otherChatId = crypto.randomUUID();
  const fetch = vi.fn().mockResolvedValue(Response.json({ state: "destroyed" }));
  vi.stubGlobal("fetch", fetch);
  const store = new EchoStore(directory);
  const unload = vi.fn();
  const registry = {
    unload,
    configure: async (action: () => Promise<void>) => action(),
  } as unknown as SessionRegistry;
  try {
    await store.saveToken("synthetic-token");
    await store.mutate((data) => {
      data.agents.push({ id: agentId, name: "Agent", instructions: "" });
      data.connection = {
        provider: "loop-sandbox",
        endpoint: "https://computer.example",
        idleSeconds: 900,
        desktop: true,
      };
      for (const [id, bound] of [
        [firstId, computerId],
        [secondId, computerId],
        [otherChatId, otherId],
      ])
        data.conversations.push({
          id,
          name: "Chat",
          agentIds: [agentId],
          responderId: agentId,
          computerId: bound,
        });
    });
    const request = new Request("http://localhost/api/echo/computers/" + computerId, {
      method: "DELETE",
    });
    const response = await echoRoutes(store, registry)(request, new URL(request.url));
    expect(response?.status).toBe(200);
    expect(fetch.mock.calls[0]![0]).toBe("https://computer.example/echo/computers/" + computerId);
    expect(fetch.mock.calls[0]![1].method).toBe("DELETE");
    expect(unload.mock.calls.map(([id]) => id)).toEqual([firstId, secondId]);
    const chats = (await store.read()).conversations;
    expect(chats.map((chat) => chat.computerId)).toEqual([undefined, undefined, otherId]);
  } finally {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  }
});

test("private Agent chat reuses the same conversation across repeated requests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-echo-private-"));
  const store = new EchoStore(directory);
  const registry = {} as SessionRegistry;
  const route = echoRoutes(store, registry);
  const agentId = crypto.randomUUID();
  try {
    await store.mutate((data) => {
      data.agents.push({ id: agentId, name: "One", instructions: "" });
    });
    const create = async () => {
      const request = new Request("http://localhost/api/echo/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "One", agentIds: [agentId], private: true }),
      });
      return (await route(request, new URL(request.url)))!.json();
    };
    const [first, second] = await Promise.all([create(), create()]);
    expect(first.id).toBe(second.id);
    expect((await store.read()).conversations).toHaveLength(1);
    expect(first.privateAgentId).toBe(agentId);
    const legacyRequest = new Request("http://localhost/api/echo/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "One", agentIds: [agentId] }),
    });
    const legacy = await route(legacyRequest, new URL(legacyRequest.url));
    expect((await legacy!.json()).id).toBe(first.id);
    expect((await store.read()).conversations).toHaveLength(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Agent creation stores an optional uploaded avatar", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-echo-avatar-"));
  try {
    const store = new EchoStore(directory);
    const route = echoRoutes(store, {} as SessionRegistry);
    const avatar = "data:image/png;base64,iVBORw0KGgo=";
    const request = new Request("http://localhost/api/echo/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "One", instructions: "", avatar }),
    });
    const response = await route(request, new URL(request.url));
    expect(response?.status).toBe(201);
    expect((await store.read()).agents[0]?.avatar).toBe(avatar);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
