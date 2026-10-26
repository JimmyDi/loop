// Vite publishes this source as a separate worklet asset; it never runs on the main thread.
declare const AudioWorkletProcessor: {
  new (): { port: MessagePort };
};
declare const registerProcessor: (name: string, processor: unknown) => void;

class LoopCaptureProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
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
