import { startClosedIngress } from "./closed-ingress";
import { startCliProcess } from "./cli-process";
import type { CliProcess } from "./cli-process";
import { RemoteAccessError } from "./errors";
import { newTunnelRecord, prepareTunnel } from "./persistent-tunnel";
import type { TunnelStore } from "./tunnel-store";

export class CliTunnel {
  private child?: CliProcess;
  private ingress?: { port: number; close(): Promise<void>; connected?(origin: string): void };
  private closing?: Promise<void>;

  constructor(
    private readonly file: string,
    private readonly store: TunnelStore,
    private readonly ingressFactory = (port: number) =>
      startClosedIngress(port) as Promise<{
        port: number;
        close(): Promise<void>;
        connected?(origin: string): void;
      }>,
  ) {}

  async start(signal: AbortSignal, failed: () => void): Promise<string> {
    let record = await this.store.read();
    signal.throwIfAborted();
    this.ingress = await this.ingressFactory(record?.port ?? 0);
    signal.throwIfAborted();
    const port = this.ingress.port;
    if (record && record.port !== port) throw new RemoteAccessError("tunnel_failed");
    if (!record) {
      record = newTunnelRecord(port);
      await this.store.save(record);
    }
    record = await prepareTunnel(this.file, this.store, record, signal);
    signal.throwIfAborted();
    const tunnelId = record.tunnelId;
    let url: string | undefined;
    let ready = false;
    let established = false;
    let exited = false;
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
        ["host", tunnelId, "--host-header", "unchanged", "--origin-header", "unchanged"],
        signal,
        (line) => {
          const id = line.match(
            /Ready to accept connections for tunnel:\s*([a-z0-9-]+(?:\.[a-z0-9]+)?)\s*$/i,
          )?.[1];
          if (id) {
            ready = id === tunnelId;
          }
          for (const match of line.matchAll(/https:\/\/[a-z0-9.-]+\.devtunnels\.ms\/?/gi)) {
            const candidate = new URL(match[0]);
            if (
              new RegExp(
                "^[a-z0-9-]+-" + port + "[.]" + tunnelId.split(".")[1] + "[.]devtunnels[.]ms$",
              ).test(candidate.hostname) &&
              (!record.origin || candidate.origin === record.origin)
            )
              url = candidate.origin;
          }
          if (ready && url) resolveReady(url);
        },
        0,
      );
      void this.child.done.then(
        () => {
          exited = true;
          rejectReady(new RemoteAccessError("tunnel_failed"));
          if (established && !signal.aborted && !this.closing) failed();
        },
        () => {
          exited = true;
          rejectReady(new RemoteAccessError("tunnel_failed"));
          if (established && !signal.aborted && !this.closing) failed();
        },
      );
      const result = await connected;
      signal.throwIfAborted();
      if (!record.origin) await this.store.save({ ...record, origin: result });
      signal.throwIfAborted();
      if (exited) throw new RemoteAccessError("tunnel_failed");
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
    } finally {
      await this.ingress?.close();
    }
  }
}
