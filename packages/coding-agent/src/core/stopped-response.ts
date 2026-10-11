import type { AssistantMessage } from "@earendil-works/pi-ai";

/** Retain visible interrupted text for history; aborted messages stay excluded from model replay. */
export const stoppedResponse = (draft?: AssistantMessage): AssistantMessage | undefined => {
  if (!draft) return;
  const content = draft.content.filter((part) => part.type === "text" && part.text.length > 0);
  if (!content.length) return;
  return structuredClone({ ...draft, content, stopReason: "aborted", errorMessage: undefined });
};
