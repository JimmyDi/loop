import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { getSessionDir, SessionManager } from "../../coding-agent/index";
import { createLoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { ProviderSettings } from "./providers/provider-settings";
import { SessionRegistry } from "./session-registry";
import { createRouter } from "./router";

test("new Web sessions remain drafts until the first user message, appear during streaming and survive restart", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".draft-session-test-"));
  const model = {
    id: "example",
    provider: "example",
    name: "Example",
    api: "openai-completions" as const,
    baseUrl: "http://localhost",
    reasoning: false,
    input: ["text" as const, "image" as const],
    contextWindow: 4096,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let reject = false;
  let calls = 0;
  const stream = createAssistantMessageEventStream();
  class Settings extends ProviderSettings {
    async runtime() {
      return {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {
          if (reject) throw new Error("Model unavailable");
        },
        streamSimple: () => {
          calls++;
          return stream;
        },
      };
    }
    defaultModel() {
      return model;
    }
    defaultEffort() {
      return undefined;
    }
  }
  const projects = new ProjectStore(join(root, "projects.json"));
  const bridge = createLoopBridge(root, new Settings(join(root, "providers.json")));
  const registry = new SessionRegistry(projects, bridge);
  const route = createRouter(registry);
  const call = (path: string, body?: unknown) =>
    route(
      new Request("http://localhost/api" + path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  try {
    const project = await projects.add(root);
    const endpoint = "/sessions?workspaceId=" + project.id;
    const first = await (await call("/sessions", { workspaceId: project.id })).json();
    const second = await (await call("/sessions", { workspaceId: project.id })).json();
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(await (await call(endpoint)).json()).toEqual([]);
    expect(await SessionManager.list(root, getSessionDir(root, root))).toEqual([]);
    const controller = await registry.get(first.sessionId);
    await controller.command("title", () => controller.session.renameTitle("Draft name"));
    expect(await (await call(endpoint)).json()).toEqual([]);
    const legacy = await SessionManager.create(root, getSessionDir(root, root));
    expect(await (await call(endpoint)).json()).toEqual([]);
    expect(
      (await call("/sessions/" + first.sessionId + "/prompt", { requestId: "empty", text: "" }))
        .status,
    ).toBe(400);
    reject = true;
    controller.prompt("rejected", "Example");
    for (let i = 0; i < 100 && controller.busy; i++) await Bun.sleep(2);
    expect(controller.busy).toBe(false);
    expect(calls).toBe(0);
    expect(await (await call(endpoint)).json()).toEqual([]);
    reject = false;
    const image = { type: "image" as const, data: "AAAA", mimeType: "image/png" };
    const body = { requestId: "first-user", text: "", images: [image] };
    const accepted = await call("/sessions/" + first.sessionId + "/prompt", body);
    expect(accepted.status).toBe(202);
    for (let i = 0; i < 100 && !calls; i++) await Bun.sleep(2);
    expect(calls).toBe(1);
    const visible = await (await call(endpoint)).json();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      id: first.sessionId,
      userMessageCount: 1,
      isGenerating: true,
    });
    expect(await (await call("/sessions/" + first.sessionId + "/prompt", body)).json()).toEqual(
      await accepted.json(),
    );
    expect(
      await Bun.file(join(getSessionDir(root, root), first.sessionId + ".jsonl")).exists(),
    ).toBe(false);
    await controller.abort();
    expect(
      await Bun.file(join(getSessionDir(root, root), first.sessionId + ".jsonl")).exists(),
    ).toBe(true);
    await registry.close();
    const restarted = new SessionRegistry(projects, bridge);
    expect(
      (await restarted.list(project.id))
        .filter((item) => item.userMessageCount > 0)
        .map((item) => item.id),
    ).toEqual([first.sessionId]);
    expect((await restarted.get(first.sessionId)).session.state.messages[0]).toMatchObject({
      role: "user",
      content: [image],
    });
    expect(await Bun.file(legacy.sessionFile!).exists()).toBe(true);
    await restarted.close();
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
