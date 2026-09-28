import { browseDirectory } from "../directories/browse";
import { createNativePicker, directoryCapabilities } from "../directories/native-picker";
import { readBody, requiredString } from "../http/input";
import { HttpError } from "../http/errors";
import { eventResponse } from "../http/sse";
import type { SessionRegistry } from "../session-registry";

export const projectRoutes = (registry: SessionRegistry) => {
  const pick = createNativePicker();

  return async (request: Request, url: URL): Promise<Response | undefined> => {
    const path = url.pathname;
    const method = request.method;
    if (path === "/api/workspaces/events" && method === "GET")
      return eventResponse(registry.events, request);
    const session = path.match(new RegExp("^/api/workspaces/([^/]+)/sessions/([^/]+)$"));
    if (session && method === "DELETE") {
      await registry.archive(session[1]!, [session[2]!], "delete-session");
      return new Response(null, { status: 204 });
    }

    if (path === "/api/workspaces") {
      if (method === "GET") return Response.json(await registry.projects.list());

      if (method === "POST") {
        const body = await readBody(request);
        const name = body.name === undefined ? undefined : requiredString(body, "name");

        const project = await registry.projects.add(requiredString(body, "path"), name);
        registry.events.publish({ type: "projects.changed", workspaceId: project.id });
        return Response.json(project);
      }
    }

    const archive = path.match(/^\/api\/workspaces\/([^/]+)\/archive$/)?.[1];
    if (archive && (method === "POST" || method === "DELETE")) {
      const body = await readBody(request);
      if (
        !Array.isArray(body.ids) ||
        body.ids.some((id) => typeof id !== "string") ||
        (method === "POST" && typeof body.archived !== "boolean")
      )
        throw new HttpError(400, "invalid_archive");
      await registry.archive(
        archive,
        body.ids,
        method === "DELETE" ? "delete" : (body.archived as boolean),
      );
      return new Response(null, { status: 204 });
    }

    const project = path.match(/^\/api\/workspaces\/([^/]+)$/)?.[1];

    if (project && method === "PATCH") {
      const body = await readBody(request);

      const renamed = await registry.projects.rename(project, requiredString(body, "name"));
      registry.events.publish({ type: "projects.changed", workspaceId: project });
      return Response.json(renamed);
    }

    if (project && method === "DELETE") {
      await registry.remove(project);

      return new Response(null, { status: 204 });
    }

    if (path === "/api/directories/capabilities" && method === "GET") {
      return Response.json(directoryCapabilities());
    }

    if (path === "/api/directories/pick" && method === "POST") {
      return Response.json({ path: await pick(request.signal) });
    }

    if (path === "/api/directories" && method === "GET") {
      return Response.json(await browseDirectory(url.searchParams.get("path") ?? undefined));
    }
  };
};
