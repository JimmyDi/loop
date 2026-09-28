import type { PromptContent } from "../../coding-agent/index";

export type PromptImage = Extract<Exclude<PromptContent, string>[number], { type: "image" }>;

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_PROMPT_BODY_BYTES = 5 * 1024 * 1024;

export const validImages = (value: unknown): value is PromptImage[] =>
  Array.isArray(value) &&
  value.length <= MAX_IMAGES &&
  value.every(
    (image) =>
      image?.type === "image" &&
      IMAGE_TYPES.includes(image.mimeType) &&
      typeof image.data === "string" &&
      image.data.length > 0 &&
      image.data.length <= Math.ceil(MAX_IMAGE_BYTES / 3) * 4 &&
      image.data.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(image.data),
  ) &&
  value.reduce(
    (size, image) =>
      size +
      (image.data.length * 3) / 4 -
      (image.data.endsWith("==") ? 2 : image.data.endsWith("=") ? 1 : 0),
    0,
  ) <= MAX_IMAGE_BYTES;

export const promptContent = (text: string, images: PromptImage[] = []): PromptContent =>
  images.length ? [...(text ? [{ type: "text" as const, text }] : []), ...images] : text;
