import { startClosedIngress } from "./closed-ingress";
import { startCliProcess, runCli } from "./cli-process";
import type { CliProcess } from "./cli-process";
import { RemoteAccessError } from "./errors";

export class CliTunnel {
  private child?: CliProcess;
  private ingress?: { port: number; close(): Promise<void>; connected?(origin: string): void };
  private tunnelId?: string;
  private closing?: Promise<void>;

  constructor(
    private readonly file: string,
    private readonly ingressFactory = () =>
      startClosedIngress(0) as Promise<{
        port: number;
        close(): Promise<void>;
        connected?(origin: string): void;
      }>,
  ) {}

  async start(signal: AbortSignal, failed: () => void): Promise<string> {
    this.ingress = await this.ingressFactory();
    signal.throwIfAborted();
    const port = this.ingress.port;
    let url: string | undefined;
    let ready = false;
    let established = false;
    let resolveReady!: (value: string) => void;
    let rejectReady!: (error: Error) => void;
    const connected = new Promise<string>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const timer = setTimeout(() => rejectReady(new RemoteAccessError("tunnel_failed")), 60_000);
    try {
      this.child = startCliProcess(
        this.file,
        ["host", "--port-number", String(port), "--protocol", "http", "--expiration", "1h"],
        signal,
        (line) => {
          const id = line.match(
            /Ready to accept connections for tunnel:\s*([a-z0-9-]+(?:\.[a-z0-9]+)?)\s*$/i,
          )?.[1];
          if (id) {
            this.tunnelId = id;
            ready = true;
          }
          for (const match of line.matchAll(/https:\/\/[a-z0-9.-]+\.devtunnels\.ms\/?/gi)) {
            const candidate = new URL(match[0]);
            if (
              new RegExp("^[a-z0-9-]+-" + port + "\\.[a-z0-9]+\\.devtunnels\\.ms$").test(
                candidate.hostname,
              )
            )
              url = candidate.origin;
          }
          if (ready && url) resolveReady(url);
        },
        0,
      );
      void this.child.done.then(
        () => {
          rejectReady(new RemoteAccessError("tunnel_failed"));
          if (established && !signal.aborted && !this.closing) failed();
        },
        () => {
          rejectReady(new RemoteAccessError("tunnel_failed"));
          if (established && !signal.aborted && !this.closing) failed();
        },
      );
      const result = await connected;
      signal.throwIfAborted();
      this.ingress.connected?.(result);
      established = true;
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  close(): Promise<void> {
    return (this.closing ??= this.dispose());
  }

  private async dispose(): Promise<void> {
    try {
      try {
        await this.ingress?.close();
      } finally {
        await this.child?.stop();
      }
      if (this.tunnelId) {
        await runCli(
          this.file,
          ["delete", this.tunnelId, "--force"],
          AbortSignal.timeout(10_000),
          10_000,
        ).catch(() => {});
      }
    } finally {
      await this.ingress?.close();
    }
  }
}
