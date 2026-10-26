import type { VoiceSpeechQueueOptions } from "./speech-queue-types";

export class VoiceSpeechQueue {
  private queue: string[] = [];
  private waiting = false;
  private epoch = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: VoiceSpeechQueueOptions) {}

  enqueue(text: string): void {
    if (!text.trim() || text.length > 120) return;
    this.queue.push(text);
    this.queue = this.queue.slice(-3);
    this.pump();
  }

  clear(): void {
    this.epoch++;
    this.waiting = false;
    this.queue = [];
    clearTimeout(this.timer);
  }

  failed(): void {
    this.clear();
    this.options.interrupt();
  }

  audio(bytes: ArrayBuffer, generation: number): void {
    if (!this.waiting || generation !== this.options.current()) return;
    const epoch = this.epoch;
    clearTimeout(this.timer);
    void this.options
      .play(bytes, generation)
      .catch(() => {})
      .finally(() => {
        if (epoch !== this.epoch) return;
        this.waiting = false;
        this.pump();
      });
  }

  private pump(): void {
    if (this.waiting) return;
    const text = this.queue.shift();
    if (!text) return;
    this.waiting = true;
    this.options.send(text);
    this.timer = setTimeout(() => {
      this.clear();
      this.options.interrupt();
    }, 45_000);
  }
}
