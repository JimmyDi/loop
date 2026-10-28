// Vite publishes this source as a separate worklet asset; it never runs on the main thread.
declare const AudioWorkletProcessor: {
  new (): { port: MessagePort };
};
declare const registerProcessor: (name: string, processor: unknown) => void;

class LoopCaptureProcessor extends AudioWorkletProcessor {
  private finished = false;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<string>) => {
      this.finished = event.data === "finish";
      if (this.finished) this.port.postMessage("finished");
    };
  }

  process(inputs: Float32Array[][]): boolean {
    if (this.finished) return true;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const mono = new Float32Array(channels[0]!.length);
    for (const channel of channels) {
      for (let index = 0; index < mono.length; index++)
        mono[index] += channel[index]! / channels.length;
    }
    this.port.postMessage(mono, [mono.buffer]);
    return true;
  }
}

registerProcessor("loop-capture", LoopCaptureProcessor);

export {};
