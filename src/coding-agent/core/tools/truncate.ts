export const MAX_BYTES = 50 * 1024;

export function truncate(text: string, tail = false): string {
  const lines = text.split("\n");
  const selected = (tail ? lines.slice(-2000) : lines.slice(0, 2000)).join("\n");
  const bytes = Buffer.from(selected);

  if (bytes.length <= MAX_BYTES) return selected;

  return (tail ? bytes.subarray(-MAX_BYTES) : bytes.subarray(0, MAX_BYTES)).toString("utf8");
}
