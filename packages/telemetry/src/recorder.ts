import { randomUUID } from "node:crypto";

import { readTrace } from "./reader";
import { sanitizeTraceData } from "./redaction";
import { acquireTraceLock, TraceWriter, writeManifest } from "./storage";
import { serializeTraceRecord } from "./serialize-record";
import type { SerializedTraceRecord } from "./serialize-record";
import type {
  TraceEvent,
  TraceInput,
  TraceManifest,
  TraceMode,
  TraceOptions,
  TraceStatus,
} from "./types";

export class TraceRecorder {
  private tail: Promise<void> = Promise.resolve();
  private seq = 0;
  private queuedBytes = 0;
  private droppedEvents = 0;
  private lastWrittenSeq = -1;
  private error?: string;
  private incomplete = false;
  private closed = false;
  private closing?: Promise<void>;
  private pending: SerializedTraceRecord[] = [];
  private pendingBytes = 0;
  private scheduled?: NodeJS.Immediate;
  private release?: () => Promise<void>;
  private startedAt = new Date().toISOString();
  private readonly writer: TraceWriter;
  readonly mode: TraceMode;

  private constructor(
    readonly directory: string,
    readonly sessionId: string,
    private readonly options: TraceOptions,
  ) {
    this.mode = options.mode ?? "content";
    this.writer = new TraceWriter(directory, options.segmentBytes ?? 8 * 1024 * 1024);
  }

  /** Storage failures disable recording, never reject session creation. */
  static async open(
    directory: string,
    sessionId: string,
    options: TraceOptions = {},
  ): Promise<TraceRecorder> {
    const recorder = new TraceRecorder(directory, sessionId, options);
    try {
      if (!["metadata", "content", "stream"].includes(recorder.mode))
        throw new Error("Invalid trace mode");
      for (const value of Object.values(options))
        if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 1))
          throw new Error("Invalid trace limit");
      recorder.release = await acquireTraceLock(directory);
      let cursor = -1;
      while (true) {
        const page = await readTrace(directory, { afterSeq: cursor, limit: 1000 });
        if (page.warnings.some((warning) => /Corrupt|Incomplete tail/.test(warning)))
          throw new Error("Existing trace is damaged; recording disabled");
        recorder.incomplete ||= page.warnings.length > 0;
        if (page.manifest && page.manifest.sessionId !== sessionId)
          throw new Error("Trace session mismatch");
        if (page.manifest) {
          recorder.startedAt = page.manifest.startedAt;
          recorder.incomplete ||= !page.manifest.complete || !page.manifest.closedAt;
          recorder.droppedEvents = page.manifest.droppedEvents;
          recorder.seq = Math.max(recorder.seq, page.manifest.nextSeq ?? 0);
        }
        cursor = page.nextSeq;
        if (!page.hasMore) break;
      }
      recorder.lastWrittenSeq = cursor;
      recorder.seq = Math.max(cursor + 1, recorder.seq);
      await recorder.writer.initialize();
      await recorder.saveManifest();
    } catch (error) {
      recorder.fail(error);
      await recorder.release?.().catch(() => {});
      recorder.release = undefined;
    }
    return recorder;
  }

  get status(): TraceStatus {
    return {
      mode: this.mode,
      enabled: this.enabled,
      complete: !this.incomplete,
      queuedBytes: this.queuedBytes,
      droppedEvents: this.droppedEvents,
      lastWrittenSeq: this.lastWrittenSeq,
      error: this.error,
    };
  }

  get enabled(): boolean {
    return !this.closed && !this.error;
  }

  record(input: TraceInput): void {
    if (!this.enabled) return;
    if (
      this.queuedBytes >= (this.options.maxQueueBytes ?? 16 * 1024 * 1024) ||
      this.writer.totalBytes + this.queuedBytes >=
        (this.options.maxSessionBytes ?? 128 * 1024 * 1024)
    ) {
      this.seq++;
      this.droppedEvents++;
      this.incomplete = true;
      return;
    }
    try {
      const event: TraceEvent = {
        schemaVersion: 1,
        eventId: randomUUID(),
        sessionId: this.sessionId,
        seq: this.seq++,
        timestamp: new Date().toISOString(),
        type: input.type,
        runId: input.runId,
        operationId: input.operationId,
        parentOperationId: input.parentOperationId,
        data: input.data === undefined ? undefined : sanitizeTraceData(input.data, this.mode),
      };
      const { record, omitted } = serializeTraceRecord(
        event,
        this.options.maxPayloadBytes ?? 8 * 1024 * 1024,
      );
      this.incomplete ||= omitted;
      const bytes = record.lineBytes + (record.payload?.bytes ?? 0);
      if (
        this.queuedBytes + bytes > (this.options.maxQueueBytes ?? 16 * 1024 * 1024) ||
        this.writer.totalBytes + this.queuedBytes + bytes >
          (this.options.maxSessionBytes ?? 128 * 1024 * 1024)
      ) {
        this.droppedEvents++;
        this.incomplete = true;
        return;
      }
      this.queuedBytes += bytes;
      this.pending.push(record);
      this.pendingBytes += bytes;
      if (this.pending.length >= 128 || this.pendingBytes >= 64 * 1024) this.enqueueBatch();
      else this.scheduled ??= setImmediate(() => this.enqueueBatch());
    } catch (error) {
      this.fail(error);
    }
  }

  private enqueueBatch(): void {
    if (this.scheduled) clearImmediate(this.scheduled);
    this.scheduled = undefined;
    if (!this.pending.length) return;
    const batch = this.pending;
    const bytes = this.pendingBytes;
    this.pending = [];
    this.pendingBytes = 0;
    this.tail = this.tail.then(async () => {
      let written = 0;
      try {
        if (!this.error) {
          await this.writer.appendBatch(batch, (count, seq) => {
            written += count;
            this.lastWrittenSeq = seq;
          });
        }
      } catch (error) {
        this.fail(error);
      } finally {
        this.droppedEvents += batch.length - written;
        this.queuedBytes -= bytes;
      }
    });
  }

  /** Drains accepted writes; this is not an fsync/power-loss durability guarantee. */
  flush(): Promise<void> {
    if (this.closed) return this.closing ?? this.tail;
    this.enqueueBatch();
    const work = this.tail.then(() => this.saveManifest()).catch((error) => this.fail(error));
    this.tail = work;
    return work;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.enqueueBatch();
    this.closed = true;
    this.closing = this.tail.then(async () => {
      try {
        await this.writer.close();
        await this.saveManifest(new Date().toISOString());
      } catch (error) {
        this.fail(error);
      } finally {
        await this.release?.().catch((error) => this.fail(error));
      }
    });
    this.tail = this.closing;
    return this.closing;
  }

  private fail(error: unknown): void {
    this.incomplete = true;
    this.error = (error as NodeJS.ErrnoException).code ?? "trace_recording_failed";
  }

  private saveManifest(closedAt?: string): Promise<void> {
    if (!this.release) return Promise.resolve();
    const manifest: TraceManifest = {
      format: "loop-trace",
      version: 1,
      sessionId: this.sessionId,
      mode: this.mode,
      startedAt: this.startedAt,
      nextSeq: this.seq,
      closedAt,
      complete: !this.incomplete,
      droppedEvents: this.droppedEvents,
      lastWrittenSeq: this.lastWrittenSeq,
      error: this.error,
    };
    return writeManifest(this.directory, manifest);
  }
}
