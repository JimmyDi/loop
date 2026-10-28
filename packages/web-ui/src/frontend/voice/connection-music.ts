export class ConnectionMusic {
  private timer?: ReturnType<typeof setInterval>;
  private readonly notes = new Map<OscillatorNode, GainNode>();
  private index = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode = context.destination,
  ) {}

  start = (): void => {
    if (this.timer || this.context.state !== "running") return;
    const play = () => {
      if (this.context.state !== "running") return;
      const note = this.context.createOscillator();
      const volume = this.context.createGain();
      const now = this.context.currentTime;
      note.type = "sine";
      note.frequency.value = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23][
        this.index++ % 8
      ]!;
      volume.gain.setValueAtTime(0, now);
      volume.gain.linearRampToValueAtTime(0.025, now + 0.04);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      note.connect(volume).connect(this.destination);
      this.notes.set(note, volume);
      note.onended = () => {
        this.notes.delete(note);
        note.disconnect();
        volume.disconnect();
      };
      note.start(now);
      note.stop(now + 0.65);
    };
    play();
    this.timer = setInterval(play, 400);
  };

  stop = (): void => {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const [note, volume] of this.notes) {
      // Disconnect synchronously: onended can be delayed by suspension or media buffering.
      note.onended = null;
      volume.gain.cancelScheduledValues(this.context.currentTime);
      volume.gain.setValueAtTime(0, this.context.currentTime);
      note.disconnect();
      volume.disconnect();
      try {
        note.stop();
      } catch {
        // A scheduled note may have already ended.
      }
    }
    this.notes.clear();
  };
}
