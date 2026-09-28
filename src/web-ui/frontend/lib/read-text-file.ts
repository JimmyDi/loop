import { isPlainText, isTextFileName } from "../../shared/prompt-files";
import type { PromptFile } from "../../shared/prompt-files";
import { ApiError } from "./api";

export const readTextFile = async (file: File): Promise<PromptFile> => {
  if (!isTextFileName(file.name))
    throw new ApiError("invalid_text_files", "invalid_text_files", 400);

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new ApiError("file_read_failed", "file_read_failed", 400);
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!isPlainText(text)) throw new Error();
    return { name: file.name, text };
  } catch {
    throw new ApiError("invalid_text_encoding", "invalid_text_encoding", 400);
  }
};
