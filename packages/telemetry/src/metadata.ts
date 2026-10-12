import type { TraceData } from "./types";

const contentKeys = new Set([
  "content",
  "context",
  "input",
  "args",
  "arguments",
  "text",
  "summary",
  "prompt",
  "systemPrompt",
  "parameters",
  "description",
  "instructions",
  "reason",
  "operations",
  "diff",
  "body",
  "data",
  "url",
  "cwd",
  "path",
  "sourcePath",
  "filePath",
  "file",
  "directory",
  "baseUrl",
  "endpoint",
  "targetPath",
  "workspaceRoot",
]);

export const isTraceContentKey = (key: string): boolean => contentKeys.has(key);

/** Preserve identities, configuration and outcomes in metadata recording mode. */
export const traceMetadata = (value: TraceData): TraceData => {
  if (Array.isArray(value)) return value.map(traceMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isTraceContentKey(key))
      .map(([key, item]) => [key, traceMetadata(item)]),
  );
};
