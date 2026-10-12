import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { traceSegments } from "./storage";
import type { TraceEvent, TraceManifest } from "./types";

type TracePage = {
  events: TraceEvent[];
  nextSeq: number;
  hasMore: boolean;
  warnings: string[];
  manifest?: TraceManifest;
};

type TraceQuery = { afterSeq?: number; limit?: number };

const validEvent = (value: unknown): value is TraceEvent => {
  if (!value || typeof value !== "object") return false;
  const row = value as TraceEvent;
  return (
    row.schemaVersion === 1 &&
    typeof row.eventId === "string" &&
    typeof row.sessionId === "string" &&
    typeof row.type === "string" &&
    typeof row.timestamp === "string" &&
    Number.isFinite(Date.parse(row.timestamp)) &&
    Number.isSafeInteger(row.seq) &&
    row.seq >= 0 &&
    (!row.payloadRef || /^payloads\/[a-f0-9-]{36}\.json$/.test(row.payloadRef))
  );
};

export const readTrace = async (directory: string, query: TraceQuery = {}): Promise<TracePage> => {
  const after = query.afterSeq ?? -1;
  const limit = query.limit ?? 200;
  if (
    !Number.isSafeInteger(after) ||
    after < -1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw new Error("Invalid trace cursor or limit");
  const page: TracePage = { events: [], nextSeq: after, hasMore: false, warnings: [] };
  try {
    const manifest = JSON.parse(
      await readFile(join(directory, "manifest.json"), "utf8"),
    ) as TraceManifest;
    if (manifest.format !== "loop-trace" || manifest.version !== 1)
      throw new Error("Unsupported trace format");
    page.manifest = manifest;
    if (!manifest.complete) page.warnings.push("Recording is incomplete");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let previous = -1;
  let pageBytes = 0;
  for (const name of await traceSegments(directory)) {
    let pending = "";
    let lineNumber = 0;
    for await (const chunk of createReadStream(join(directory, name), { encoding: "utf8" })) {
      pending += chunk;
      if (pending.length > 16 * 1024 * 1024) throw new Error("Trace row exceeds read limit");
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        lineNumber++;
        let event: TraceEvent;
        try {
          const value: unknown = JSON.parse(line);
          if (
            !validEvent(value) ||
            value.seq <= previous ||
            (page.manifest && value.sessionId !== page.manifest.sessionId)
          )
            throw new Error("Invalid event");
          event = value;
        } catch {
          page.warnings.push(`Corrupt trace at ${name}:${lineNumber}`);
          return page;
        }
        if (event.seq !== previous + 1)
          page.warnings.push(`Event gap before sequence ${event.seq}`);
        previous = event.seq;
        if (event.seq <= after) continue;
        if (page.events.length >= limit) {
          page.hasMore = true;
          return page;
        }
        if (event.payloadRef) {
          try {
            const path = join(directory, event.payloadRef);
            if ((await stat(path)).size > 8 * 1024 * 1024) throw new Error("Payload too large");
            event.data = JSON.parse(await readFile(path, "utf8"));
          } catch {
            page.warnings.push(`Missing or invalid payload for sequence ${event.seq}`);
          }
        }
        const bytes = Buffer.byteLength(JSON.stringify(event));
        if (page.events.length && pageBytes + bytes > 16 * 1024 * 1024) {
          page.hasMore = true;
          return page;
        }
        pageBytes += bytes;
        page.events.push(event);
        page.nextSeq = event.seq;
      }
    }
    if (pending) {
      page.warnings.push(`Incomplete tail in ${name}`);
      return page;
    }
  }
  return page;
};
