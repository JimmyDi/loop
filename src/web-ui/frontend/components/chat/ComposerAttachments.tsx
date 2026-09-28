import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { IMAGE_TYPES, MAX_IMAGES } from "../../../shared/prompt-images";
import type { PromptImage } from "../../../shared/prompt-images";
import { ActionButton } from "../ui/ActionButton";
import "./ComposerAttachments.css";

export const ComposerAttachments = ({
  images,
  disabled,
  add,
  remove,
}: {
  images: PromptImage[];
  disabled: boolean;
  add(files: File[]): void;
  remove(index: number): void;
}) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="composer-attachments">
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        disabled={disabled}
        onChange={(event) => {
          add([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <ActionButton
        className="composer-attach ghost"
        aria-label={t("attachImages")}
        title={t("attachImages")}
        disabled={disabled || images.length >= MAX_IMAGES}
        onClick={() => input.current?.click()}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" />
          <path d="m8 13 6-6" />
        </svg>
      </ActionButton>
      {images.map((image, index) => (
        <div className="composer-attachment" key={index}>
          <img
            src={"data:" + image.mimeType + ";base64," + image.data}
            alt={t("imageAttachment", { index: index + 1 })}
          />
          <ActionButton
            disabled={disabled}
            aria-label={t("removeImage", { index: index + 1 })}
            onClick={() => remove(index)}
          >
            ×
          </ActionButton>
        </div>
      ))}
    </div>
  );
};
