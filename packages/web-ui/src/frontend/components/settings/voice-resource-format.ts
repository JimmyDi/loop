export const voiceResourceBytes = (size: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size / 1024 / 1024) +
  " MiB";
