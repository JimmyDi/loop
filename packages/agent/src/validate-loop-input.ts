import type { AgentLoopOptions, PromptContent } from "./types";

export const validateLoopInput = (content: PromptContent, options: AgentLoopOptions): void => {
  if (
    Array.isArray(content) &&
    content.some(
      (part) =>
        !part ||
        (part.type === "text"
          ? typeof part.text !== "string"
          : part.type !== "image" ||
            typeof part.data !== "string" ||
            !part.data ||
            typeof part.mimeType !== "string" ||
            !part.mimeType),
    )
  )
    throw new Error("Invalid prompt content");
  if (
    typeof content === "string"
      ? !content.trim()
      : !Array.isArray(content) ||
        !content.length ||
        !content.some((part) => part.type === "image" || (part.type === "text" && part.text.trim()))
  )
    throw new Error("Prompt is required");
  if (
    Array.isArray(content) &&
    content.some((part) => part.type === "image") &&
    !options.model.input.includes("image")
  )
    throw new Error("Model does not support image input");

  if (typeof options.streamFn !== "function") throw new Error("streamFn is required");

  if (
    options.maxTurns !== undefined &&
    (!Number.isSafeInteger(options.maxTurns) || options.maxTurns < 1)
  ) {
    throw new Error("maxTurns must be a positive integer");
  }
};
