export class RunController {
  readonly abortController = new AbortController();
  private paused = false;

  cancel() {
    this.abortController.abort();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  get isPaused() {
    return this.paused;
  }

  async waitIfPaused() {
    while (this.paused && !this.abortController.signal.aborted)
      await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
