import type { Message } from "@earendil-works/pi-ai";

import type { SessionTitle, TitleInput } from "./types";

export function normalizeTitle(value: string, maxBytes = 120): string {
  const clean = value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  let result = "";
  let bytes = 0;
  for (const character of clean) {
    bytes += new TextEncoder().encode(character).length;
    if (bytes > maxBytes) break;
    result += character;
  }
  return result.trim();
}

export function titleInputs(messages: readonly Message[]): TitleInput[] {
  return messages.flatMap((message, index) => {
    if (message.role !== "user") return [];
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    return normalizeTitle(text) ? [{ index, text }] : [];
  });
}

export function fallbackTitle(input: TitleInput): SessionTitle {
  return {
    text: normalizeTitle(normalizeTitle(input.text, 96).split(" ").slice(0, 8).join(" "), 96),
    source: "fallback",
    messageIndices: [input.index],
  };
}

export function validTitle(value: unknown): value is SessionTitle {
  if (!value || typeof value !== "object") return false;
  const title = value as SessionTitle;
  return (
    typeof title.text === "string" &&
    !!title.text &&
    normalizeTitle(title.text) === title.text &&
    ["fallback", "model", "user"].includes(title.source) &&
    Array.isArray(title.messageIndices) &&
    title.messageIndices.every(
      (index, i, all) =>
        Number.isSafeInteger(index) && index >= 0 && (i === 0 || index > all[i - 1]!),
    ) &&
    (title.model === undefined ||
      (!!title.model &&
        typeof title.model.provider === "string" &&
        typeof title.model.id === "string"))
  );
}
