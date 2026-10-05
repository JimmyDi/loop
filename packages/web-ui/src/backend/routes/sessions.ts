import { readBody, requiredString } from "../http/input";
import { eventResponse } from "../http/sse";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";
import { isModelEffort, isPermissionPreset } from "@loop/coding-agent";
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

        const archived = url.searchParams.get("archived") === "true";
        return Response.json(
          (await registry.list(id)).filter(
            (session) =>
              !!session.archived === archived && (archived || session.userMessageCount > 0),
          ),
        );
      }

      if (method === "POST") {
        const body = await readBody(request);
        const controller = await registry.create(requiredString(body, "workspaceId"));

        return Response.json(controller.snapshot, { status: 201 });
      }
    }

    const match = url.pathname.match(
      /^\/api\/sessions\/([^/]+)(?:\/(prompt|abort|flush|model|events|title|permission|approvals|read|pin)(?:\/([^/]+))?)?$/,
    );

    if (!match) return;

    const [, id, action, requestId] = match;
    if ((action === "approvals") !== !!requestId) return;
    if (action === "pin") {
      if (method !== "PUT") throw new HttpError(405, "method_not_allowed");
      const body = await readBody(request);
      if (typeof body.pinned !== "boolean") throw new HttpError(400, "invalid_pinned_state");
      const pinnedAt = await registry.setPinned(
        requiredString(body, "workspaceId"),
        id!,
        body.pinned,
      );
      return Response.json({ pinnedAt: pinnedAt ?? null });
    }
    if (action === "read") {
      if (method !== "PUT") throw new HttpError(405, "method_not_allowed");
      const body = await readBody(request);
      if (typeof body.messageCount !== "number")
        throw new HttpError(400, "invalid_read_message_count");
      const read = await registry.markRead(
        requiredString(body, "workspaceId"),
        id!,
        body.messageCount,
      );
      return Response.json({ read });
    }
    const body =
      action === "prompt" ||
      action === "model" ||
      action === "permission" ||
      action === "approvals" ||
      (action === "title" && method === "PUT")
        ? await readBody(request, action === "prompt" ? Infinity : undefined)
        : {};
    const controller = await registry.get(id!);

    registry.assertAvailable(controller.workspaceId);

    if (!action && method === "GET") return Response.json(controller.snapshot);

    if (action === "events" && method === "GET")
      return eventResponse(
        url.searchParams.get("approvals") === "1" ? controller.approvals : controller.events,
        request,
      );

    if (action === "approvals" && method === "POST") {
      if (body.decision !== "allowed-once" && body.decision !== "rejected")
        throw new HttpError(400, "invalid_approval_decision");
      controller.approvals.respond(requestId!, body.decision);
      return Response.json(controller.snapshot);
    }

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

    if (action === "permission" && method === "PUT") {
      if (!isPermissionPreset(body.preset)) throw new HttpError(400, "invalid_permission_preset");
      const preset = body.preset;
      await controller.command("permission", () => controller.session.setPermissionPreset(preset));
    } else if (action === "title" && method === "PUT") {
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
