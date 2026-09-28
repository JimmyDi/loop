import { useTranslation } from "react-i18next";

import type { PromptImage } from "../../../shared/prompt-images";
import type { PromptFile } from "../../../shared/prompt-files";
import { ActionButton } from "../ui/ActionButton";
import { TextFileAttachment } from "./TextFileAttachment";
import "./ComposerAttachments.css";

export const ComposerAttachments = ({
  images,
  files,
  disabled,
  remove,
  removeFile,
}: {
  images: PromptImage[];
  files: PromptFile[];
  disabled: boolean;
  remove(index: number): void;
  removeFile(index: number): void;
}) => {
  const { t } = useTranslation();
  if (!images.length && !files.length) return null;

  return (
    <div className="composer-attachments">
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
      {files.map((file, index) => (
        <div className="composer-file-attachment" key={index}>
          <TextFileAttachment file={file} />
          <ActionButton
            disabled={disabled}
            aria-label={t("removeFile", { name: file.name })}
            onClick={() => removeFile(index)}
          >
            ×
          </ActionButton>
        </div>
      ))}
    </div>
  );
};
