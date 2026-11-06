import type { SessionController } from "../session-controller";
import { readBody } from "../http/input";
import { HttpError } from "../http/errors";
import { timelinePreviews } from "../../shared/timeline-navigation";

export const navigationRoute = async (
  request: Request,
  controller: SessionController,
): Promise<Response> => {
  if (request.method === "PUT") {
    const body = await readBody(request);
    const index = body.messageIndex;
    if (body.streamId !== controller.snapshot.streamId) throw new HttpError(409, "history_changed");
    if (
      typeof index !== "number" ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      controller.session.sessionManager.messages[index]?.role !== "user" ||
      typeof body.bookmarked !== "boolean"
    )
      throw new HttpError(400, "invalid_bookmark");
    const bookmarks = await controller.session.sessionManager.setBookmark(index, body.bookmarked);
    return Response.json({ bookmarks });
  }
  if (request.method !== "GET") throw new HttpError(405, "method_not_allowed");
  return Response.json({
    previews: timelinePreviews(controller.snapshot.state.messages),
    bookmarks: controller.session.sessionManager.getHeader().bookmarks ?? [],
  });
};
