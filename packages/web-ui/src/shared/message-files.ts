export const localFilePath = (source: string): string | undefined => {
  if (!source || source.startsWith("//") || source.startsWith("#")) return;
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
  if (!path || path.includes(String.fromCharCode(0)) || path.endsWith("/")) return;
  return path;
};

export const filePreviewType = (path: string): "audio" | "video" | "pdf" | undefined => {
  const extension = path.split(".").at(-1)?.toLowerCase();
  if (["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"].includes(extension ?? "")) return "audio";
  if (["mp4", "webm", "mov", "ogv"].includes(extension ?? "")) return "video";
  if (extension === "pdf") return "pdf";
};
