import { roundStart } from "../../shared/session-history";
import type { SessionController } from "../session-controller";
import { HttpError } from "../http/errors";
import { eventResponse } from "../http/sse";

export const historyRoute = (
  request: Request,
  url: URL,
  action: string | undefined,
  controller: SessionController,
): Response | undefined => {
  const method = request.method;
  if (action === "history" && method === "GET") {
    if (url.searchParams.get("streamId") !== controller.snapshot.streamId)
      throw new HttpError(409, "history_changed");
    const raw = url.searchParams.get("before");
    const before = raw && /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
    const messages = controller.snapshot.state.messages;
    if (
      !Number.isSafeInteger(before) ||
      before < 0 ||
      before > messages.length ||
      (before < messages.length && messages[before]?.role !== "user")
    )
      throw new HttpError(400, "invalid_history_cursor");
    const start = roundStart(messages, before);
    return Response.json({
      streamId: controller.snapshot.streamId,
      start,
      end: before,
      total: messages.length,
      userStart: messages.slice(0, start).filter((message) => message.role === "user").length,
      messages: messages.slice(start, before),
    });
  }

  if (action === "events" && method === "GET")
    return eventResponse(
      {
        connect: (listener, cursor, close) =>
          (url.searchParams.get("approvals") === "1"
            ? controller.approvals
            : controller.events
          ).connect(listener, cursor, close),
      },
      request,
    );

  return undefined;
};
