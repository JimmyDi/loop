import type { SessionController } from "../session-controller";
import { readBody, requiredString } from "../http/input";
import { HttpError } from "../http/errors";
import { queuedContent } from "../../shared/queued-content";
import { promptContent, validImages } from "../../shared/prompt-images";
import { validTextFiles } from "../../shared/prompt-files";

export const queueRoute = async (
  request: Request,
  action: string,
  controller: SessionController,
): Promise<Response> => {
  if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const session = controller.session;
  if (action === "resume") {
    if (!session.resume) throw new HttpError(400, "resume_unavailable");
    if (
      !session.state.canResume ||
      controller.snapshot.operation !== "idle" ||
      session.state.hasPendingSave
    )
      throw new HttpError(409, "resume_unavailable");
    void session.resume().catch(() => {});
    return Response.json({ accepted: true }, { status: 202 });
  }
  const body = await readBody(request, Infinity);
  const id = requiredString(body, "id");
  const item = session.state.queue?.find((item) => item.id === id);
  if (!item) throw new HttpError(409, "queue_item_missing");
  try {
    if (body.action === "edit" && session.editQueued) {
      if (typeof body.text !== "string") throw new HttpError(400, "invalid_text");
      const original = queuedContent(item.content);
      const images = body.images ?? original.images;
      const files = body.files ?? original.files;
      if (!validImages(images)) throw new HttpError(400, "invalid_images");
      if (!validTextFiles(files)) throw new HttpError(400, "invalid_text_files");
      const skills = body.skills;
      if (
        skills !== undefined &&
        (!Array.isArray(skills) ||
          skills.length > 8 ||
          skills.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id)))
      )
        throw new HttpError(400, "invalid_skills");
      session.editQueued(
        id,
        promptContent(body.text, images, files),
        skills as string[] | undefined,
      );
    } else if (body.action === "begin-edit" && session.beginQueuedEdit) session.beginQueuedEdit(id);
    else if (body.action === "cancel-edit" && session.cancelQueuedEdit)
      session.cancelQueuedEdit(id);
    else if (body.action === "delete" && session.deleteQueued) session.deleteQueued(id);
    else if (body.action === "steer" && session.steerQueued) session.steerQueued(id);
    else if (body.action === "move" && session.moveQueued) {
      if (body.beforeId !== undefined && typeof body.beforeId !== "string")
        throw new HttpError(400, "invalid_queue_order");
      session.moveQueued(id, body.beforeId as string | undefined);
    } else throw new HttpError(400, "invalid_queue_action");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      409,
      "queue_conflict",
      error instanceof Error ? error.message : String(error),
    );
  }
  return Response.json({
    accepted: true,
    ...(body.action === "begin-edit"
      ? { item: session.state.queue?.find((item) => item.id === id) }
      : {}),
  });
};
