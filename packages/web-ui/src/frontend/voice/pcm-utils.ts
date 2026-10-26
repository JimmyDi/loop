export const pcmEnergy = (samples: Int16Array): number => {
  let squares = 0;
  for (const sample of samples) squares += (sample / 32768) ** 2;
  return Math.sqrt(squares / Math.max(1, samples.length));
};

export const pcmBytes = (samples: Int16Array): ArrayBuffer => {
  const bytes = new ArrayBuffer(samples.length * 2);
  const view = new DataView(bytes);
  samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
  return bytes;
};
