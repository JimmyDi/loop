export const localImagePath = (source: string): string | undefined => {
  if (!source || source.startsWith("//")) return;
  let path = source;
  if (/^file:/i.test(path)) {
    try {
      const url = new URL(path);
      if (url.hostname && url.hostname !== "localhost") return;
      path = url.pathname;
    } catch {
      return;
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[/\\]/i.test(path)) return;
  try {
    path = decodeURIComponent(path);
  } catch {
    return;
  }
  if (path.includes(String.fromCharCode(0)) || !/[.](?:png|jpe?g|gif|webp)$/i.test(path)) return;
  return path;
};
