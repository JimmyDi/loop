import { useRef, useState } from "react";

import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, validImages } from "../../shared/prompt-images";
import type { PromptImage } from "../../shared/prompt-images";
import { ApiError } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";

export const useComposerImages = (sessionId: string) => {
  const [pending, setPending] = useState(false);
  const reading = useRef(false);
  const [error, setError] = useState<unknown>();
  const add = async (files: File[]) => {
    if (!files.length || reading.current) return;
    reading.current = true;
    setPending(true);
    setError(undefined);
    try {
      const current = useWorkspace.getState().images[sessionId] ?? [];
      if (
        files.length + current.length > MAX_IMAGES ||
        files.some((file) => !IMAGE_TYPES.includes(file.type)) ||
        files.reduce((size, file) => size + file.size, 0) > MAX_IMAGE_BYTES
      )
        throw new ApiError("invalid_images", "invalid_images", 400);
      const added = await Promise.all(
        files.map(
          (file) =>
            new Promise<PromptImage>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  type: "image",
                  mimeType: file.type,
                  data: String(reader.result).split(",")[1] ?? "",
                });
              reader.onerror = () =>
                reject(new ApiError("image_read_failed", "image_read_failed", 400));
              reader.readAsDataURL(file);
            }),
        ),
      );
      const next = [...current, ...added];
      if (!validImages(next)) throw new ApiError("invalid_images", "invalid_images", 400);
      useWorkspace.getState().attach(sessionId, next);
    } catch (error) {
      setError(error);
    } finally {
      reading.current = false;
      setPending(false);
    }
  };
  const remove = (index: number) => {
    const current = useWorkspace.getState().images[sessionId] ?? [];
    useWorkspace.getState().attach(
      sessionId,
      current.filter((_, i) => i !== index),
    );
    setError(undefined);
  };
  return { add, remove, pending, error };
};
