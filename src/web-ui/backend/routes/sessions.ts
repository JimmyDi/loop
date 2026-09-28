import { readBody, requiredString } from "../http/input";
import { eventResponse } from "../http/sse";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";
import { isModelEffort } from "../../../coding-agent/index";
import { validImages } from "../../shared/prompt-images";
import { validTextFiles } from "../../shared/prompt-files";

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
      /^\/api\/sessions\/([^/]+)(?:\/(prompt|abort|flush|model|events|title))?$/,
    );

    if (!match) return;

    const [, id, action] = match;
    const body =
      action === "prompt" || action === "model" || (action === "title" && method === "PUT")
        ? await readBody(request, action === "prompt" ? Infinity : undefined)
        : {};
    const controller = await registry.get(id!);

    registry.assertAvailable(controller.workspaceId);

    if (!action && method === "GET") return Response.json(controller.snapshot);

    if (action === "events" && method === "GET") return eventResponse(controller.events, request);

    if (action === "prompt" && method === "POST") {
      const requestId = requiredString(body, "requestId");

      if (requestId.length > 128) throw new HttpError(400, "invalid_requestId");

      const images = body.images ?? [];
      const files = body.files ?? [];
      if (!validImages(images)) throw new HttpError(400, "invalid_images");
      if (!validTextFiles(files)) throw new HttpError(400, "invalid_text_files");
      if (typeof body.text !== "string" || (!body.text.trim() && !images.length && !files.length))
        throw new HttpError(400, "invalid_text");
      const runId = controller.prompt(requestId, body.text, images, files);

      return Response.json({ runId }, { status: 202 });
    }

    if (action === "title" && method === "PUT") {
      const title = requiredString(body, "title");
      await controller.command("title", () => controller.session.renameTitle(title));
    } else if (action === "title" && method === "POST") {
      await controller.command("title", () => controller.session.refreshTitle());
    } else if (action === "abort" && method === "POST") await controller.abort();
    else if (action === "flush" && method === "POST") {
      await controller.command("flush", () => controller.session.flush());
    } else if (action === "model" && method === "PUT") {
      if (body.effort !== undefined && !isModelEffort(body.effort))
        throw new HttpError(400, "invalid_model_effort");
      const choice = { provider: requiredString(body, "provider"), id: requiredString(body, "id") };
      const model = (await registry.loop.models()).find(
        (model) => model.provider === choice.provider && model.id === choice.id,
      );
      if (
        isModelEffort(body.effort) &&
        body.effort !== "default" &&
        !model?.efforts?.includes(body.effort)
      )
        throw new HttpError(400, "invalid_model_effort");

      await controller.command("model", () =>
        registry.loop.setModel(controller.session, {
          ...choice,
          ...(isModelEffort(body.effort) ? { effort: body.effort } : {}),
        }),
      );
    } else throw new HttpError(405, "method_not_allowed");

    return Response.json(controller.snapshot);
  };
