import { RemoteAccessError } from "./errors";

const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });

type Tunnel = {
  start(signal: AbortSignal, failed: () => void): Promise<string>;
  healthy(signal: AbortSignal): Promise<boolean>;
  close(): Promise<void>;
};

export class TunnelRecovery {
  private readonly abort = new AbortController();
  private tunnel?: Tunnel;
  private operation?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private closing?: Promise<void>;
  private attempts = 0;
  private connectedAt = 0;
  private disconnected = 0;
  private recoveryRequested = false;
  private signal!: AbortSignal;
  private failed = () => {};
  private changed = (_url?: string) => {};

  constructor(private readonly create: () => Tunnel) {}

  async start(
    signal: AbortSignal,
    failed: () => void,
    changed: (url?: string) => void = () => {},
  ): Promise<string> {
    this.signal = AbortSignal.any([signal, this.abort.signal]);
    this.failed = failed;
    this.changed = changed;
    const url = await this.connect();
    this.schedule();
    return url;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.abort.abort();
    clearTimeout(this.timer);
    return (this.closing = (async () => {
      await this.operation;
      await this.disconnect();
    })());
  }

  private async connect(): Promise<string> {
    this.signal.throwIfAborted();
    const tunnel = this.create();
    this.tunnel = tunnel;
    let connecting = true;
    let exited = false;
    const started = Date.now();
    const url = await tunnel.start(this.signal, () => {
      exited = true;
      if (!connecting && this.tunnel === tunnel) this.recover();
    });
    const deadline = Date.now() + 45_000;
    let stableSince: number | undefined;
    while (Date.now() < deadline && !exited) {
      this.signal.throwIfAborted();
      try {
        const healthy = await tunnel.healthy(this.signal);
        stableSince =
          healthy && Date.now() - started >= 4000 ? (stableSince ?? Date.now()) : undefined;
      } catch {
        stableSince = undefined;
      }
      if (stableSince !== undefined && Date.now() - stableSince >= 2000) {
        this.signal.throwIfAborted();
        if (exited) break;
        connecting = false;
        this.connectedAt = Date.now();
        this.disconnected = 0;
        return url;
      }
      await delay(1000, this.signal);
    }
    throw new RemoteAccessError("tunnel_failed");
  }

  private schedule(): void {
    if (this.signal.aborted) return;
    this.timer = setTimeout(() => {
      this.operation = this.probe().finally(() => {
        this.finish();
      });
    }, 30_000);
    this.timer.unref();
  }

  private async probe(): Promise<void> {
    try {
      const healthy = await this.tunnel!.healthy(this.signal);
      if (this.signal.aborted) return;
      this.disconnected = healthy ? 0 : this.disconnected + 1;
      if (healthy && Date.now() - this.connectedAt >= 60_000) this.attempts = 0;
    } catch {
      // An unavailable control API does not prove that a host has disconnected.
      this.disconnected = 0;
    }
    if (this.disconnected >= 2) {
      // Queue after this probe releases operation, so recovery never overlaps it.
      this.timer = setTimeout(() => this.recover(), 0);
    } else this.schedule();
  }

  private recover(): void {
    if (this.signal.aborted) return;
    if (this.operation) {
      this.recoveryRequested = true;
      return;
    }
    clearTimeout(this.timer);
    this.changed();
    this.operation = this.retry().finally(() => {
      this.finish();
    });
  }

  private finish(): void {
    this.operation = undefined;
    if (!this.recoveryRequested) return;
    this.recoveryRequested = false;
    this.recover();
  }

  private async retry(): Promise<void> {
    try {
      await this.disconnect();
      while (!this.signal.aborted && this.attempts < 6) {
        await delay(Math.min(30_000, 1000 * 2 ** this.attempts++), this.signal);
        try {
          const url = await this.connect();
          this.changed(url);
          this.schedule();
          return;
        } catch {
          await this.disconnect();
        }
      }
    } catch {
      // Cancellation stops delays and probes; cleanup still owns the current host.
    }
    if (!this.signal.aborted) this.failed();
  }

  private async disconnect(): Promise<void> {
    const tunnel = this.tunnel;
    this.tunnel = undefined;
    await tunnel?.close();
  }
}
