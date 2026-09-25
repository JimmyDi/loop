import type { ProviderInput } from "../../shared/provider";
import { HttpError } from "../http/errors";

export const validateProvider = (input: Record<string, unknown>): ProviderInput => {
  const field = (key: string, limit: number) => {
    const value = input[key];

    if (typeof value !== "string" || !value.trim() || value.length > limit)
      throw new HttpError(400, "invalid_provider");

    return value.trim();
  };
  const name = field("name", 100);
  const modelId = field("modelId", 200);
  let url: URL;

  try {
    url = new URL(field("baseUrl", 2048));
  } catch {
    throw new HttpError(400, "invalid_provider_url");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /\/(chat\/completions|responses)\/?$/.test(url.pathname)
  )
    throw new HttpError(400, "invalid_provider_url");

  if (input.authentication !== "apiKey" && input.authentication !== "none")
    throw new HttpError(400, "invalid_provider");

  if (
    input.apiKey !== undefined &&
    (typeof input.apiKey !== "string" || input.apiKey.length > 8192)
  )
    throw new HttpError(400, "invalid_provider");

  return {
    name,
    modelId,
    baseUrl: url.toString().replace(/\/+$/, ""),
    authentication: input.authentication,
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : undefined,
  };
};
