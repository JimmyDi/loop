export class VoiceInputCompletion {
  private pending?: {
    id: string;
    promise: Promise<void>;
    resolve(): void;
    reject(error: unknown): void;
    timer: ReturnType<typeof setTimeout>;
  };

  wait = (send: (requestId: string) => void | Promise<void>): Promise<void> => {
    if (this.pending) return this.pending.promise;
    const id = crypto.randomUUID();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const timer = setTimeout(() => this.fail(new Error("voice_engine_timeout")), 65_000);
    this.pending = { id, promise, resolve, reject, timer };
    try {
      void Promise.resolve(send(id)).catch((error) => this.fail(error));
    } catch (error) {
      this.fail(error);
    }
    return promise;
  };

  complete = (id: string): void => {
    if (this.pending?.id === id) this.cancel();
  };

  cancel = (): void => {
    const pending = this.pending;
    this.pending = undefined;
    clearTimeout(pending?.timer);
    pending?.resolve();
  };

  fail = (error: unknown): void => {
    const pending = this.pending;
    this.pending = undefined;
    clearTimeout(pending?.timer);
    pending?.reject(error);
  };
}
