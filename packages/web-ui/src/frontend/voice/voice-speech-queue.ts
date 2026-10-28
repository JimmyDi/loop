import { speechSegments } from "./speech-segments";
import type { VoiceSpeechQueueOptions } from "./speech-queue-types";

export class VoiceSpeechQueue {
  private queue: string[] = [];
  private waiting = false;
  private playing = false;
  private ready?: { bytes: ArrayBuffer; generation: number };
  private epoch = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: VoiceSpeechQueueOptions) {}

  enqueue(text: string): void {
    this.queue.push(...speechSegments(text));
    this.pump();
  }

  clear(): void {
    this.epoch++;
    this.waiting = false;
    this.playing = false;
    this.ready = undefined;
    this.queue = [];
    clearTimeout(this.timer);
  }

  failed(): void {
    this.clear();
    this.options.interrupt();
  }

  audio(bytes: ArrayBuffer, generation: number): void {
    if (!this.waiting || generation !== this.options.current()) return;
    clearTimeout(this.timer);
    this.waiting = false;
    this.ready = { bytes, generation };
    this.playReady();
  }

  private playReady(): void {
    if (this.playing || !this.ready) return;
    const { bytes, generation } = this.ready;
    const epoch = this.epoch;
    this.ready = undefined;
    this.playing = true;
    void this.options
      .play(bytes, generation)
      .catch(() => {})
      .finally(() => {
        if (epoch !== this.epoch) return;
        this.playing = false;
        this.playReady();
        this.pump();
      });
    this.pump();
  }

  private pump(): void {
    // Bound prefetch to one synthesized segment beyond the current playback.
    if (this.waiting || this.ready) return;
    const text = this.queue.shift();
    if (!text) return;
    this.waiting = true;
    this.options.send(text);
    this.timer = setTimeout(() => this.failed(), 45_000);
  }
}
