import type { TextContent } from "@earendil-works/pi-ai";

const markers = ["<!-- loop:commentary -->", "<!-- loop:final -->"];

/** Interpret presentation metadata without changing model events or stored text. */
export const readAssistantText = (part: TextContent, streaming = false): { text: string } => {
  const text = part.text.trimStart();
  for (const marker of markers) {
    if (text.startsWith(marker)) {
      return { text: text.slice(marker.length).trimStart() };
    }
  }
  // Never flash a split marker while its leading bytes are still arriving.
  if (
    text &&
    markers.some((marker) => marker.startsWith(text)) &&
    (streaming || text.startsWith("<!-- loop:"))
  )
    return { text: "" };
  return { text: part.text };
};
