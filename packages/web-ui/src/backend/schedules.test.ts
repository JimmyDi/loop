import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";
import { createSchedules } from "./schedules";
import { createLoopBridge } from "./loop";
import { SessionRegistry } from "./session-registry";
import { ProjectStore } from "./projects/project-store";
import { ProviderSettings } from "./providers/provider-settings";
import { createBusinessRouter } from "./business-router";

test.each(["read-only", "danger-full-access"])(
  "scheduled HTTP run creates a fresh managed chat with %s and stores its result",
  async (permission) => {
    const root = await mkdtemp(join(tmpdir(), "loop-schedule-web-"));
    const nextTurn = Promise.withResolvers<void>();
    const emitDelta = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let requests = 0;
    const provider = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const titleRequest = JSON.parse(body).messages.some(
        (message: { content?: unknown }) =>
          typeof message.content === "string" &&
          message.content.includes("Name this coding conversation"),
      );
      response.writeHead(200, { "content-type": "text/event-stream" });
      const send = (delta: unknown, finishReason: string | null) =>
        response.write(
          "data: " +
            JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] }) +
            "\n\n",
        );
      if (titleRequest) {
        send({ role: "assistant", content: "Example title" }, null);
        send({}, "stop");
      } else if (++requests === 1) {
        send(
          {
            tool_calls: [
              {
                index: 0,
                id: "call_test",
                type: "function",
                function: { name: "unknown_tool", arguments: "{}" },
              },
            ],
          },
          null,
        );
        send({}, "tool_calls");
      } else {
        nextTurn.resolve();
        await emitDelta.promise;
        send({ role: "assistant", content: "Final " }, null);
        await finish.promise;
        send({ content: "reply" }, null);
        send({}, "stop");
      }
      response.end("data: [DONE]\n\n");
    });
    provider.listen(0, "127.0.0.1");
    await once(provider, "listening");
    const settings = new ProviderSettings(join(root, "provider.json"));
    const registry = new SessionRegistry(
      new ProjectStore(join(root, "projects.json")),
      createLoopBridge(root, settings),
    );
    const schedules = createSchedules(root, registry);
    const peerRegistry = new SessionRegistry(
      new ProjectStore(join(root, "projects.json")),
      createLoopBridge(root, settings),
    );
    const peer = createSchedules(root, peerRegistry);
    const route = createBusinessRouter(
      peerRegistry,
      settings,
      undefined,
      undefined,
      undefined,
      undefined,
      peer,
    );
    const post = (path: string, body: unknown) =>
      route(
        new Request("http://localhost/api/schedules" + path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    try {
      await settings.upsert(
        {
          id: "example",
          kind: "custom",
          name: "Example",
          api: "openai-completions",
          baseUrl: "http://127.0.0.1:" + (provider.address() as AddressInfo).port + "/v1",
          models: [{ id: "example" }],
          authentication: "none",
        },
        true,
      );
      await schedules.start();
      await peer.start();
      expect(peer.owner).toBe(false);
      const empty = await route(new Request("http://localhost/api/schedules"));
      expect(await empty.json()).toEqual([]);
      const anchorAt = Date.now() + 60_000;
      const preview = await post("/preview", {
        trigger: { kind: "interval", anchorAt, everyMs: 60_000 },
      });
      expect(await preview.json()).toEqual([anchorAt, anchorAt + 60_000, anchorAt + 120_000]);
      const extended = await post("/preview", {
        trigger: { kind: "interval", anchorAt, everyMs: 60_000 },
        limit: 4,
      });
      expect(await extended.json()).toEqual([
        anchorAt,
        anchorAt + 60_000,
        anchorAt + 120_000,
        anchorAt + 180_000,
      ]);
      const once = await post("/preview", { trigger: { kind: "once", at: anchorAt }, limit: 4 });
      expect(await once.json()).toEqual([anchorAt]);
      const project = await registry.projects.add(root);
      const response = await post("", {
        name: "Review",
        projectId: project.id,
        prompt: "Summarize",
        trigger: { kind: "once", at: Date.now() + 3600000 },
        missed: "ask",
        permission,
      });
      const plan = await response.json();
      expect(response.ok).toBe(true);
      expect(plan.permission).toBe(permission);
      // A bodyless HTTP action can reach the router as a non-null, zero-byte stream.
      const action = (suffix: string, method = "POST") =>
        route(
          new Request("http://localhost/api/schedules/" + plan.id + suffix, {
            method,
            headers: { "Content-Type": "application/json" },
            body: method === "GET" ? undefined : "",
          }),
        );
      expect((await action("/pause")).status).toBe(204);
      expect(schedules.list()[0]?.status).toBe("paused");
      expect((await action("/resume")).status).toBe(204);
      expect(schedules.list()[0]?.status).toBe("active");
      // The sidebar refreshes on its own host's event stream, without opening the chat or run history.
      const sidebarRefreshes: Promise<string[]>[] = [];
      peerRegistry.events.connect((frame) => {
        if (frame.type === "sessions.changed" && frame.workspaceId === project.id)
          sidebarRefreshes.push(
            peerRegistry.list(project.id).then(
              (rows) => rows.map((row) => row.id),
              () => [],
            ),
          );
      });
      const completions = [registry, peerRegistry].map((host) => {
        const reads: Promise<boolean>[] = [];
        host.events.connect((frame) => {
          if (frame.type !== "schedules.changed") return;
          reads.push(
            Promise.all([
              route(new Request("http://localhost/api/schedules")).then((response) =>
                response.json(),
              ),
              route(new Request("http://localhost/api/schedules/runs")).then((response) =>
                response.json(),
              ),
            ]).then(
              ([plans, runs]) => !plans[0]?.activeRun && runs[0]?.status === "completed",
              () => false,
            ),
          );
        });
        return reads;
      });
      const manual = await post("/" + plan.id + "/run", { requestId: crypto.randomUUID() });
      const queued = await manual.json();
      expect(queued).toMatchObject({
        scheduleId: plan.id,
        source: "manual",
        status: "queued",
      });
      await vi.waitFor(() => expect(requests).toBeGreaterThanOrEqual(2));
      await nextTurn.promise;
      const firstRun = (await schedules.history(plan.id))[0]!;
      const sessionUrl = "http://localhost/api/sessions/" + firstRun.sessionId;
      const listUrl = "http://localhost/api/sessions?workspaceId=" + project.id;
      expect(await (await route(new Request(listUrl))).json()).toEqual([
        expect.objectContaining({ id: firstRun.sessionId, isGenerating: true }),
      ]);
      const snapshot = await route(new Request(sessionUrl));
      expect(await snapshot.json()).toMatchObject({ operation: "prompt" });
      const stream = await route(new Request(sessionUrl + "/events?approvals=1"));
      expect(stream.status).toBe(200);
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      const firstFrame = decoder.decode((await reader.read()).value);
      expect(firstFrame).toContain("session.snapshot");
      expect(firstFrame).toContain("unknown_tool");
      expect(firstFrame).toContain('"operation":"prompt"');
      emitDelta.resolve();
      let streamed = "";
      while (!streamed.includes('"delta":"Final "')) {
        const chunk = await reader.read();
        expect(chunk.done).toBe(false);
        streamed += decoder.decode(chunk.value, { stream: true });
      }
      expect((await schedules.history(plan.id))[0]?.status).toBe("running");
      finish.resolve();
      while (!(await reader.read()).done) {
        // Drain the owner's remaining events before reconnecting to disk.
      }
      const reconnected = await route(new Request(sessionUrl + "/events?approvals=1"));
      const nextReader = reconnected.body!.getReader();
      const nextFrame = new TextDecoder().decode((await nextReader.read()).value);
      expect(nextFrame).toContain("Final reply");
      expect(await (await route(new Request(listUrl))).json()).toEqual([
        expect.objectContaining({ id: firstRun.sessionId, isGenerating: false, unread: true }),
      ]);
      await nextReader.cancel();
      await vi.waitFor(async () =>
        expect((await schedules.history(plan.id))[0]?.status).toBe("completed"),
      );
      await vi.waitFor(async () => {
        for (const reads of completions) expect(await Promise.all(reads)).toContain(true);
      });
      const [run] = await schedules.history(plan.id);
      expect(run!.sessionId).toBeTruthy();
      expect(run!.input.permission).toBe(permission);
      await vi.waitFor(async () =>
        expect((await Promise.all(sidebarRefreshes)).flat()).toContain(run!.sessionId),
      );
      const progress = await action("/runs/" + queued.id, "GET");
      expect(await progress.json()).toEqual({ status: "completed", sessionId: run!.sessionId });
      const missing = await action("/runs/manual-" + crypto.randomUUID(), "GET");
      expect(await missing.json()).toBeNull();
      const pageUrl = "http://localhost/api/schedules/runs/page";
      expect(await (await route(new Request(pageUrl + "?limit=1"))).json()).toEqual({
        runs: [{ ...run, input: { name: run!.input.name, projectId: run!.input.projectId } }],
        nextCursor: null,
      });
      const cursor = [run!.scheduledFor, run!.scheduleId, run!.id].join("/");
      expect(
        await (await route(new Request(pageUrl + "?after=" + encodeURIComponent(cursor)))).json(),
      ).toEqual({ runs: [], nextCursor: null });
      const history = await route(new Request("http://localhost/api/schedules/runs"));
      expect(await history.json()).toEqual([run]);
      const session = await registry.get(run!.sessionId!);
      expect(session.session.state.permissionPreset).toBe(permission);
      expect(session.session.state.messages[0]?.role).toBe("user");
      expect((await registry.list(project.id)).map((s) => s.id)).toContain(run!.sessionId);
      expect((await action("/runs/" + run!.id + "/archive")).status).toBe(204);
      expect((await schedules.historyPage(50)).runs[0]?.archived).toBe(true);
      expect((await action("/runs/" + run!.id + "/restore")).status).toBe(204);
      expect((await schedules.historyPage(50)).runs[0]?.archived).toBe(false);
      expect(peer.owner).toBe(false);
      expect((await action("", "DELETE")).status).toBe(204);
      expect(schedules.list()).toEqual([]);
      await schedules.close();
      const after = await route(new Request("http://localhost/api/schedules/runs"));
      expect(await after.json()).toEqual([{ ...run, archived: false }]);
      expect((await action("/runs/" + run!.id, "DELETE")).status).toBe(204);
      expect(await peer.history()).toEqual([]);
      expect(await peer.findRun(plan.id, run!.id)).toBeUndefined();
      expect((await peerRegistry.get(run!.sessionId!)).session.sessionId).toBe(run!.sessionId);
      expect(peer.owner).toBe(true);
    } finally {
      emitDelta.resolve();
      finish.resolve();
      await peer.close();
      await schedules.close();
      await peerRegistry.close();
      await registry.close();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      await rm(root, { recursive: true, force: true });
    }
  },
);
