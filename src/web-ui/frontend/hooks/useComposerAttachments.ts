import { useRef, useState } from "react";

import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, validImages } from "../../shared/prompt-images";
import type { PromptImage } from "../../shared/prompt-images";
import { MAX_TEXT_FILES, validTextFiles } from "../../shared/prompt-files";
import { ApiError } from "../lib/api";
import { readTextFile } from "../lib/read-text-file";
import { useWorkspace } from "../state/workspace-store";

export const useComposerAttachments = (sessionId: string) => {
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
      const currentFiles = useWorkspace.getState().files[sessionId] ?? [];
      const imageFiles = files.filter((file) => IMAGE_TYPES.includes(file.type));
      const textFiles = files.filter((file) => !IMAGE_TYPES.includes(file.type));
      if (
        imageFiles.length + current.length > MAX_IMAGES ||
        imageFiles.reduce((size, file) => size + file.size, 0) > MAX_IMAGE_BYTES
      )
        throw new ApiError("invalid_images", "invalid_images", 400);
      if (textFiles.length + currentFiles.length > MAX_TEXT_FILES)
        throw new ApiError("invalid_text_files", "invalid_text_files", 400);
      const addedFiles = await Promise.all(textFiles.map(readTextFile));
      const added = await Promise.all(
        imageFiles.map(
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
      const state = useWorkspace.getState();
      const next = [...(state.images[sessionId] ?? []), ...added];
      const nextFiles = [...(state.files[sessionId] ?? []), ...addedFiles];
      if (!validImages(next)) throw new ApiError("invalid_images", "invalid_images", 400);
      if (!validTextFiles(nextFiles))
        throw new ApiError("invalid_text_files", "invalid_text_files", 400);
      useWorkspace.setState({
        images: { ...state.images, [sessionId]: next },
        files: { ...state.files, [sessionId]: nextFiles },
      });
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
  const removeFile = (index: number) => {
    const current = useWorkspace.getState().files[sessionId] ?? [];
    useWorkspace.getState().attachFiles(
      sessionId,
      current.filter((_, i) => i !== index),
    );
    setError(undefined);
  };
  return { add, remove, removeFile, pending, error };
};
