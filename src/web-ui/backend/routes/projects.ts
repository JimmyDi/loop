import { browseDirectory } from "../directories/browse";
import { createNativePicker, directoryCapabilities } from "../directories/native-picker";
import { readBody, requiredString } from "../http/input";
import type { SessionRegistry } from "../session-registry";

export const projectRoutes = (registry: SessionRegistry) => {
  const pick = createNativePicker();

  return async (request: Request, url: URL): Promise<Response | undefined> => {
    const path = url.pathname;
    const method = request.method;

    if (path === "/api/workspaces") {
      if (method === "GET") return Response.json(await registry.projects.list());

      if (method === "POST") {
        const body = await readBody(request);
        const name = body.name === undefined ? undefined : requiredString(body, "name");

        return Response.json(await registry.projects.add(requiredString(body, "path"), name));
      }
    }

    const project = path.match(/^\/api\/workspaces\/([^/]+)$/)?.[1];

    if (project && method === "PATCH") {
      const body = await readBody(request);

      return Response.json(await registry.projects.rename(project, requiredString(body, "name")));
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
