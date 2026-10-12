import { isTraceContentKey } from "./metadata";
import type { TraceData, TraceMode } from "./types";

const secretKey =
  /^(?:authorization|proxy[_-]?authorization|cookies?|set[_-]?cookie|api[_-]?key|password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|headers)$/i;

/** Best-effort credential filtering; callers must also use field allowlists. */
export const redactCredentials = (text: string): string =>
  text
    .replace(
      /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END (?:[A-Z ]*PRIVATE KEY)-----/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+[^\s"',;]+/gi, "Bearer [REDACTED]")
    .replace(/\bBasic\s+[a-zA-Z0-9+/=]+/gi, "Basic [REDACTED]")
    .replace(/((?:cookie|set-cookie|authorization)\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/\b(?:sk-[a-zA-Z0-9_-]{8,}|gh[pousr]_[a-zA-Z0-9]{8,})\b/g, "[REDACTED]")
    .replace(
      /((?:api[_-]?key|password|access[_-]?token|refresh[_-]?token|client[_-]?secret)["']?\s*[=:]\s*["']?)[^\s"',;}]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:token|key|signature|sig|x-amz-signature)=)[^&#\s]+/gi, "$1[REDACTED]");

export const sanitizeTraceData = (value: unknown, mode?: TraceMode): TraceData => {
  const ancestors = new Set<object>();
  const visit = (entry: unknown, depth: number): TraceData => {
    if (depth > 64) return "[DEPTH_LIMIT]";
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "string") return redactCredentials(entry);
    if (typeof entry === "boolean") return entry;
    if (typeof entry === "number") return Number.isFinite(entry) ? entry : null;
    if (typeof entry !== "object") return "[UNSUPPORTED]";
    if (ancestors.has(entry)) return "[CIRCULAR]";
    ancestors.add(entry);
    let result: TraceData;
    if (Array.isArray(entry)) result = entry.map((item) => visit(item, depth + 1));
    else {
      const row = entry as Record<string, unknown>;
      result = Object.fromEntries(
        Object.keys(row)
          .filter((key) => mode !== "metadata" || !isTraceContentKey(key))
          .map((key) => [key, row[key]] as const)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [
            key,
            secretKey.test(key)
              ? "[REDACTED]"
              : row.type === "image" && key === "data"
                ? "[IMAGE_OMITTED]"
                : visit(item, depth + 1),
          ]),
      );
    }
    ancestors.delete(entry);
    return result;
  };
  return visit(value, 0);
};
