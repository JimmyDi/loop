import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { SkillManager } from "@loop/coding-agent";

import { createRouter } from "../router";
import type { SessionRegistry } from "../session-registry";

test("skill preview, installation, management and origin validation use core contracts", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-skills-route-"));
  const manager = new SkillManager(join(root, "personal"), join(root, "shared"));
  const registry = { projects: { get: async () => ({ cwd: root }) } } as unknown as SessionRegistry;
  const route = createRouter(registry, undefined, undefined, undefined, manager);
  const request = (path: string, method = "GET", body?: unknown, origin?: string) =>
    route(
      new Request("http://localhost/api/settings/skills" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  try {
    expect((await request("/preview", "POST", { kind: "invalid" })).status).toBe(400);
    expect(
      (await request("/preview", "POST", { kind: "created" }, "https://example.com")).status,
    ).toBe(403);
    const response = await request("/preview", "POST", {
      kind: "created",
      content: "---\nname: example\ndescription: Review source\n---\nReview the source.",
    });
    expect(response.status).toBe(202);
    const job = await response.json();
    await vi.waitFor(() => expect(manager.installer.get(job.id).status).toBe("ready"));
    expect(
      (await request("/install", "POST", { jobId: job.id, keys: ["created"], scope: "project" }))
        .status,
    ).toBe(400);
    expect(
      (
        await request("/install?workspaceId=example", "POST", {
          jobId: job.id,
          keys: ["created"],
          scope: "project",
        })
      ).status,
    ).toBe(200);
    await manager.refresh(root);
    const skill = manager.view(root).skills[0]!;
    expect(
      (await request("/" + skill.id + "/enabled?workspaceId=example", "PATCH", { enabled: false }))
        .status,
    ).toBe(200);
    expect((await request("/" + skill.id + "?workspaceId=example")).status).toBe(200);
    expect((await request("/" + skill.id + "?workspaceId=example", "DELETE")).status).toBe(200);
    expect(manager.view(root).skills).toEqual([]);
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});
