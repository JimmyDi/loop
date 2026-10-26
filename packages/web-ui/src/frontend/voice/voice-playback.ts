export class VoicePlayback {
  private generation = 0;
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private completions = new Map<AudioBufferSourceNode, () => void>();
  private tail = Promise.resolve();
  private queuedBytes = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly activity: (playing: boolean) => void,
  ) {}

  interrupt(): number {
    this.generation++;
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* A source can finish during interruption. */
      }
      source.disconnect();
      this.completions.get(source)?.();
    }
    this.sources.clear();
    this.completions.clear();
    this.tail = Promise.resolve();
    this.nextStart = 0;
    this.activity(false);
    return this.generation;
  }

  current(): number {
    return this.generation;
  }

  play(bytes: ArrayBuffer, generation: number): Promise<void> {
    if (generation !== this.generation || this.queuedBytes + bytes.byteLength > 4_000_000)
      return Promise.resolve();
    this.queuedBytes += bytes.byteLength;
    this.tail = this.tail
      .then(async () => {
        if (generation !== this.generation || this.context.state !== "running") return;
        const buffer = await this.context.decodeAudioData(bytes.slice(0));
        if (generation !== this.generation || this.context.state !== "running") return;
        if (
          this.sources.size >= 8 ||
          Math.max(0, this.nextStart - this.context.currentTime) + buffer.duration > 30
        )
          return;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        this.sources.add(source);
        await new Promise<void>((resolve) => {
          this.completions.set(source, resolve);
          source.onended = () => {
            source.disconnect();
            this.sources.delete(source);
            this.completions.delete(source);
            if (!this.sources.size) this.activity(false);
            resolve();
          };
          this.nextStart = Math.max(this.context.currentTime, this.nextStart);
          source.start(this.nextStart);
          this.nextStart += buffer.duration;
          this.activity(true);
        });
      })
      .catch(() => this.activity(false))
      .finally(() => {
        this.queuedBytes -= bytes.byteLength;
      });
    return this.tail;
  }
}
