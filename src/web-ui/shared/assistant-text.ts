import type { Message } from "./protocol";

type TextContent = Extract<
  Extract<Message, { role: "assistant" }>["content"][number],
  { type: "text" }
>;

export type AssistantTextPhase = "commentary" | "final_answer";

const markers = [
  ["<!-- loop:commentary -->", "commentary"],
  ["<!-- loop:final -->", "final_answer"],
] as const;

const signaturePhase = (signature?: string): AssistantTextPhase | undefined => {
  if (!signature?.startsWith("{")) return undefined;
  try {
    const value = JSON.parse(signature);
    if (
      value?.v === 1 &&
      typeof value.id === "string" &&
      (value.phase === "commentary" || value.phase === "final_answer")
    )
      return value.phase;
  } catch {
    // Other providers use opaque signatures, not phase metadata.
  }
  return undefined;
};

/** Interpret presentation metadata without changing model events or stored text. */
export const readAssistantText = (
  part: TextContent,
  streaming = false,
): { text: string; phase?: AssistantTextPhase } => {
  const phase = signaturePhase(part.textSignature);
  const text = part.text.trimStart();
  for (const [marker, markerPhase] of markers) {
    if (text.startsWith(marker)) {
      return { text: text.slice(marker.length).trimStart(), phase: phase ?? markerPhase };
    }
  }
  // Never flash a split marker while its leading bytes are still arriving.
  if (
    text &&
    markers.some(([marker]) => marker.startsWith(text)) &&
    (streaming || text.startsWith("<!-- loop:"))
  )
    return { text: "", phase };
  return { text: part.text, phase };
};
