import { readBody, requiredString } from "../http/input";
import { eventResponse } from "../http/sse";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";

export const sessionRoutes =
  (registry: SessionRegistry) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    const method = request.method;

    if (url.pathname === "/api/models" && method === "GET") {
      return Response.json(await registry.loop.models());
    }

    if (url.pathname === "/api/sessions") {
      if (method === "GET") {
        const id = url.searchParams.get("workspaceId");

        if (!id) throw new HttpError(400, "invalid_workspaceId");

        return Response.json(await registry.list(id));
      }

      if (method === "POST") {
        const body = await readBody(request);
        const controller = await registry.create(requiredString(body, "workspaceId"));

        return Response.json(controller.snapshot, { status: 201 });
      }
    }

    const match = url.pathname.match(
      /^\/api\/sessions\/([^/]+)(?:\/(prompt|abort|flush|model|events))?$/,
    );

    if (!match) return;

    const [, id, action] = match;
    const body = action === "prompt" || action === "model" ? await readBody(request) : {};
    const controller = await registry.get(id!);

    registry.assertAvailable(controller.workspaceId);

    if (!action && method === "GET") return Response.json(controller.snapshot);

    if (action === "events" && method === "GET") return eventResponse(controller.events, request);

    if (action === "prompt" && method === "POST") {
      const requestId = requiredString(body, "requestId");

      if (requestId.length > 128) throw new HttpError(400, "invalid_requestId");

      const runId = controller.prompt(requestId, requiredString(body, "text"));

      return Response.json({ runId }, { status: 202 });
    }

    if (action === "abort" && method === "POST") await controller.abort();
    else if (action === "flush" && method === "POST") {
      await controller.command("flush", () => controller.session.flush());
    } else if (action === "model" && method === "PUT") {
      const choice = { provider: requiredString(body, "provider"), id: requiredString(body, "id") };

      await controller.command("model", () => registry.loop.setModel(controller.session, choice));
    } else throw new HttpError(405, "method_not_allowed");

    return Response.json(controller.snapshot);
  };
