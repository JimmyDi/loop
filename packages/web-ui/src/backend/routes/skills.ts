import { SkillError } from "@loop/coding-agent";
import type { SkillManager, SkillPreviewInput } from "@loop/coding-agent";

import type { SessionRegistry } from "../session-registry";
import { readBody, requiredString } from "../http/input";
import { HttpError } from "../http/errors";

export const skillRoutes =
  (manager: SkillManager, registry: SessionRegistry) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    if (!url.pathname.startsWith("/api/settings/skills")) return;
    const path = url.pathname.slice("/api/settings/skills".length);
    const workspaceId = url.searchParams.get("workspaceId");
    const cwd = workspaceId ? (await registry.projects.get(workspaceId)).cwd : manager.agentDir;
    try {
      if (!path && request.method === "GET") return Response.json(manager.view(cwd));
      if (path === "/refresh" && request.method === "POST") {
        await manager.refresh(cwd);
        return Response.json(manager.view(cwd));
      }
      if (path === "/preview" && request.method === "POST") {
        const body = await readBody(request);
        if (!["github", "local", "created"].includes(String(body.kind)))
          throw new HttpError(400, "invalid_skill_source");
        for (const key of ["location", "ref", "content"])
          if (body[key] !== undefined && typeof body[key] !== "string")
            throw new HttpError(400, "invalid_skill_source");
        return Response.json(manager.installer.preview(body as SkillPreviewInput), { status: 202 });
      }
      const job = path.match(/^\/jobs\/([a-z0-9-]+)$/);
      if (job) {
        if (request.method === "GET") return Response.json(manager.installer.get(job[1]!));
        if (request.method === "DELETE") {
          manager.installer.cancel(job[1]!);
          return new Response(null, { status: 204 });
        }
      }
      if (path === "/install" && request.method === "POST") {
        const body = await readBody(request);
        if (
          !Array.isArray(body.keys) ||
          body.keys.length > 30 ||
          body.keys.some((key) => typeof key !== "string")
        )
          throw new HttpError(400, "invalid_skill_selection");
        if (body.scope !== "personal" && body.scope !== "project")
          throw new HttpError(400, "invalid_skill_scope");
        if (body.scope === "project" && !workspaceId)
          throw new HttpError(400, "skill_project_required");
        if (body.updateId !== undefined && typeof body.updateId !== "string")
          throw new HttpError(400, "invalid_skill_selection");
        await manager.install(
          cwd,
          requiredString(body, "jobId"),
          body.keys as string[],
          body.scope,
          body.updateId as string | undefined,
        );
        return Response.json(manager.view(cwd));
      }
      const skill = path.match(/^\/([a-f0-9]{24})(?:\/(enabled|update))?$/);
      if (!skill) return;
      if (!skill[2] && request.method === "GET")
        return Response.json(await manager.detail(cwd, skill[1]!));
      if (!skill[2] && request.method === "DELETE") {
        await manager.remove(cwd, skill[1]!);
        return Response.json(manager.view(cwd));
      }
      if (skill[2] === "enabled" && request.method === "PATCH") {
        const body = await readBody(request);
        if (typeof body.enabled !== "boolean") throw new HttpError(400, "invalid_enabled");
        await manager.toggle(cwd, skill[1]!, body.enabled);
        return Response.json(manager.view(cwd));
      }
      if (skill[2] === "update" && request.method === "POST")
        return Response.json(await manager.previewUpdate(cwd, skill[1]!), { status: 202 });
      throw new HttpError(405, "method_not_allowed");
    } catch (error) {
      if (error instanceof SkillError) throw new HttpError(400, error.code, error.message);
      throw error;
    }
  };
