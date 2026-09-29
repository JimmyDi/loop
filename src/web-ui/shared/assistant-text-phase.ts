export type AssistantTextPhase = "commentary" | "final_answer";

/** Read native Pi AI phase metadata; message text is never a display protocol. */
export const assistantTextPhase = (signature?: string): AssistantTextPhase | undefined => {
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
