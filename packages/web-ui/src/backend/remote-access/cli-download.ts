import type { FileHandle } from "node:fs/promises";

import type { RemoteAccessStatus } from "../../shared/remote-access";

export type DownloadProgress = NonNullable<RemoteAccessStatus["download"]>;

const maxBytes = 100 * 1024 * 1024;

export class CliDownload {
  private received = 0;
  private total?: number;
  private validator?: string;
  private paused = false;
  private active = false;
  private request?: AbortController;
  private wake?: () => void;
  private remainingMs = 600_000;

  constructor(
    private readonly url: string,
    private readonly handle: FileHandle,
    private readonly signal: AbortSignal,
    private readonly progress: (value: DownloadProgress) => void,
  ) {}

  pause(paused: boolean): boolean {
    if (!this.active || this.paused === paused) return false;
    this.paused = paused;
    if (paused) this.request?.abort();
    else this.wake?.();
    this.report();
    return true;
  }

  async run(): Promise<void> {
    this.active = true;
    try {
      this.report();
      while (true) {
        await this.wait();
        this.signal.throwIfAborted();
        if (this.total !== undefined && this.received === this.total) return;
        const request = new AbortController();
        this.request = request;
        const started = performance.now();
        try {
          if (await this.transfer(request.signal)) {
            await this.wait();
            this.signal.throwIfAborted();
            return;
          }
        } catch (error) {
          this.signal.throwIfAborted();
          if (!request.signal.aborted) throw error;
        } finally {
          this.remainingMs -= performance.now() - started;
          this.request = undefined;
        }
      }
    } finally {
      this.active = false;
    }
  }

  private report(): void {
    this.progress({ received: this.received, total: this.total, paused: this.paused });
  }

  private async wait(): Promise<void> {
    this.signal.throwIfAborted();
    if (!this.paused) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.signal.removeEventListener("abort", abort);
        this.wake = undefined;
      };
      const abort = () => {
        cleanup();
        reject(this.signal.reason);
      };
      this.wake = () => {
        cleanup();
        resolve();
      };
      this.signal.addEventListener("abort", abort, { once: true });
      if (this.signal.aborted) abort();
    });
  }

  private async transfer(pausing: AbortSignal): Promise<boolean> {
    if (this.remainingMs <= 0) throw new Error();
    const signal = AbortSignal.any([
      this.signal,
      pausing,
      AbortSignal.timeout(Math.ceil(this.remainingMs)),
    ]);
    const headers: Record<string, string> = {
      "Accept-Encoding": "identity",
      "x-ms-version": "2023-11-03",
    };
    if (this.received) {
      headers.Range = "bytes=" + this.received + "-";
      if (this.validator) headers["If-Range"] = this.validator;
    }
    const response = await fetch(this.url, { redirect: "error", signal, headers });
    const reader = response.body?.getReader();
    try {
      signal.throwIfAborted();
      const encoding = response.headers.get("content-encoding");
      if (!reader || (encoding && encoding !== "identity")) throw new Error();
      if (response.status === 200) {
        await this.handle.truncate(0);
        this.received = 0;
        const length = response.headers.get("content-length");
        this.total = length === null ? undefined : Number(length);
        const etag = response.headers.get("etag");
        this.validator = etag?.startsWith('"')
          ? etag
          : (response.headers.get("last-modified") ?? undefined);
      } else if (response.status === 206 && this.received) {
        const range = /^bytes ([0-9]+)-([0-9]+)[/]([0-9]+)$/.exec(
          response.headers.get("content-range") ?? "",
        );
        if (!range) throw new Error();
        const start = Number(range[1]);
        const end = Number(range[2]);
        const size = Number(range[3]);
        if (
          start !== this.received ||
          end < start ||
          end !== size - 1 ||
          (this.total !== undefined && size !== this.total)
        )
          throw new Error();
        this.total = size;
      } else throw new Error();
      if (
        this.total !== undefined &&
        (!Number.isSafeInteger(this.total) || this.total < 0 || this.total > maxBytes)
      )
        throw new Error();
      this.report();
      while (true) {
        const { done, value } = await reader.read();
        signal.throwIfAborted();
        if (done) break;
        if (
          this.received + value.byteLength > maxBytes ||
          (this.total !== undefined && this.received + value.byteLength > this.total)
        )
          throw new Error();
        let offset = 0;
        while (offset < value.byteLength) {
          const { bytesWritten } = await this.handle.write(
            value,
            offset,
            value.byteLength - offset,
            this.received + offset,
          );
          if (!bytesWritten) throw new Error();
          offset += bytesWritten;
        }
        this.received += value.byteLength;
        this.report();
      }
      if (this.total !== undefined && this.received !== this.total) throw new Error();
      return true;
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
}
