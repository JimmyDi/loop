/** Streaming linear resampling preserves fractional positions across worklet blocks. */
export class PcmResampler {
  private position = 0;
  private previous = 0;

  constructor(
    private readonly inputRate: number,
    private readonly outputRate = 16_000,
  ) {}

  push(input: Float32Array): Int16Array {
    const step = this.inputRate / this.outputRate;
    const samples: number[] = [];
    while (this.position < input.length - 1) {
      const index = Math.floor(this.position);
      const left = index < 0 ? this.previous : input[index]!;
      const right = input[index + 1]!;
      const value = left + (right - left) * (this.position - index);
      samples.push(Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767)));
      this.position += step;
    }
    this.position -= input.length;
    this.previous = input.at(-1) ?? this.previous;
    return Int16Array.from(samples);
  }
}
