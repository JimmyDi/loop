import { HttpError } from "../http/errors";

export const assertRemoteOrigin = (request: Request, origin: string): void => {
  const supplied = request.headers.get("origin");
  if (
    (supplied && supplied !== origin) ||
    (!supplied && !["GET", "HEAD"].includes(request.method)) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "invalid_origin");
};

/** Explicitly approved business routes. New endpoints remain closed by default. */
export const allowsRemoteBusiness = (path: string, method: string): boolean => {
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
  const match = path.match(
    /^\/api\/sessions\/[^/]+\/(events|prompt|queue|resume|abort|flush|compact|model|title|permission|read|pin|approvals\/[^/]+)$/,
  );
  if (!match) return false;
  if (match[1] === "events") return method === "GET";
  if (["model", "permission", "read", "pin"].includes(match[1]!)) return method === "PUT";
  if (match[1] === "title") return method === "POST" || method === "PUT";
  return method === "POST";
};
