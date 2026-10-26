import { HttpError } from "../http/errors";

export const assertRemoteOrigin = (request: Request, origin: string): void => {
  const supplied = request.headers.get("origin");
  const read = ["GET", "HEAD"].includes(request.method);
  // Browser handoffs and sign-in redirects may retain cross-site navigation metadata.
  const pairingNavigation =
    read &&
    ["/", "/index.html", "/remote.html"].includes(new URL(request.url).pathname) &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.headers.get("sec-fetch-dest") === "document";
  if (
    (supplied && supplied !== origin) ||
    (!supplied && !read) ||
    (request.headers.get("sec-fetch-site") === "cross-site" && !pairingNavigation)
  )
    throw new HttpError(403, "invalid_origin");
};

/** Explicitly approved business routes. New endpoints remain closed by default. */
export const allowsRemoteBusiness = (path: string, method: string): boolean => {
  if (path === "/api/voice/status") return method === "GET";
  if (path === "/api/voice/calls") return method === "POST";
  if (/^\/api\/voice\/calls\/[a-f0-9-]{36}\/(connect|close)$/.test(path)) return method === "POST";
  if (
    method === "GET" &&
    [
      "/api/workspaces",
      "/api/workspaces/events",
      "/api/sessions",
      "/api/models",
      "/api/settings/skills",
    ].includes(path)
  )
    return true;
  if (method === "POST" && path === "/api/sessions") return true;
  if (/^\/api\/sessions\/[^/]+$/.test(path)) return method === "GET";
  if (/^[/]api[/]sessions[/][^/]+[/](images|files)$/.test(path))
    return method === "GET" || method === "HEAD";
  const match = path.match(
    /^\/api\/sessions\/[^/]+\/(history|events|prompt|queue|resume|abort|flush|compact|model|title|permission|read|pin|approvals\/[^/]+)$/,
  );
  if (!match) return false;
  if (match[1] === "events" || match[1] === "history") return method === "GET";
  if (["model", "permission", "read", "pin"].includes(match[1]!)) return method === "PUT";
  if (match[1] === "title") return method === "POST" || method === "PUT";
  return method === "POST";
};
