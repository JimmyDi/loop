import { HttpError } from "./errors";

export type BusinessContext = {
  principal: string;
  remote: boolean;
  expiresAt?: number;
  origin?: string;
};

export type BusinessHandler = (request: Request, context?: BusinessContext) => Promise<Response>;

export const localContext: BusinessContext = { principal: "local", remote: false };

export const writeContext = (headers: Headers, context: BusinessContext): void => {
  headers.delete("x-loop-principal");
  headers.delete("x-loop-expiry");
  headers.delete("x-loop-source-origin");
  headers.set("x-loop-principal", context.remote ? context.principal : "local");
  if (context.remote && context.expiresAt) headers.set("x-loop-expiry", String(context.expiresAt));
  if (context.origin) headers.set("x-loop-source-origin", context.origin);
};

// Only call after the private business worker's Bearer authentication succeeds.
export const readContext = (headers: Headers): BusinessContext => {
  const principal = headers.get("x-loop-principal");
  const sourceOrigin = headers.get("x-loop-source-origin");
  const origin =
    sourceOrigin && new URL(sourceOrigin).origin === sourceOrigin ? sourceOrigin : undefined;
  if (principal === "local") return { ...localContext, ...(origin ? { origin } : {}) };
  const expiresAt = Number(headers.get("x-loop-expiry"));
  if (
    !principal ||
    !/^[a-f0-9-]{36}$/.test(principal) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  )
    throw new HttpError(401, "device_unauthorized");
  return { principal, remote: true, expiresAt, ...(origin ? { origin } : {}) };
};
