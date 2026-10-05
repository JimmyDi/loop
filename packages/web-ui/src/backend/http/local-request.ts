import { HttpError } from "./errors";

export const assertLocalRequest = (request: Request): void => {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");

  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    (host !== null && host !== url.host)
  )
    throw new HttpError(403, "invalid_host");

  if (origin && origin !== url.origin) throw new HttpError(403, "invalid_origin");

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "invalid_origin");
  }
};
