export class SpeechActivity {
  private frames = 0;
  private silence = 0;
  private speaking = false;

  reset(): void {
    this.frames = 0;
    this.silence = 0;
    this.speaking = false;
  }

  push(energy: number): "start" | "end" | undefined {
    if (energy >= 0.018) {
      this.silence = 0;
      if (++this.frames >= 3 && !this.speaking) {
        this.speaking = true;
        return "start";
      }
    } else {
      this.frames = 0;
      if (this.speaking && ++this.silence >= 60) {
        this.reset();
        return "end";
      }
    }
    return undefined;
  }
}
