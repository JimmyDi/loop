import { pageSnapshot } from "../shared/session-history";
import { eventResponse } from "./http/sse";
import { historyRoute } from "./routes/session-history";
import { sessionSummaries } from "./session-summaries";
import type { SessionController } from "./session-controller";

export const scheduledChatRoute = (
  request: Request,
  url: URL,
  live?: { item: SessionController; stream: AbortController },
): Response | undefined => {
  if (request.method !== "GET") return;
  if (url.pathname === "/live/api/sessions") {
    return Response.json(
      live ? (sessionSummaries([], [live.item], live.item.workspaceId)[0] ?? null) : null,
    );
  }
  const match = /^\/live\/api\/sessions\/([a-f0-9-]{36})(?:\/(events|history))?$/.exec(
    url.pathname,
  );
  if (!match || !live || match[1] !== live.item.session.sessionId) return;
  const { item, stream } = live;
  if (match[2] === "events") {
    return eventResponse(
      item.events,
      new Request(request, { signal: AbortSignal.any([stream.signal, request.signal]) }),
    );
  }
  if (match[2] === "history") return historyRoute(request, url, "history", item);
  return Response.json(pageSnapshot(item.snapshot));
};
