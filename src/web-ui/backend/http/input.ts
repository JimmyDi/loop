import { HttpError } from "./errors";

export const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "json_required");
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (reader) {
      const { done, value } = await reader.read();

      if (done) break;

      size += value.byteLength;

      if (size > 1_048_576) {
        await reader.cancel();
        throw new HttpError(413, "body_too_large");
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));

    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();

    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(400, "invalid_body");
  } finally {
    reader?.releaseLock();
  }
};

export const requiredString = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];

  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "invalid_" + key);

  return value;
};
