export const pcmWave = (samples: Uint8Array, sampleRate: number): Uint8Array => {
  if (
    samples.byteLength % 2 ||
    samples.byteLength > 4_000_000 ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 96000
  )
    throw new Error("voice_audio_invalid");
  const bytes = Buffer.alloc(44 + samples.byteLength);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples.byteLength, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.byteLength, 40);
  bytes.set(samples, 44);
  return bytes;
};
