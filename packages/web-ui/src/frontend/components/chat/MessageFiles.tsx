import { useState } from "react";
import { useTranslation } from "react-i18next";

import { filePreviewType } from "../../../shared/message-files";
import "./MessageFiles.css";

export const MessageFiles = ({ files }: { files: { href: string; label: string }[] }) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!files.length) return null;
  return (
    <div className="message-files">
      {files.map(({ href, label }, index) => {
        const path = new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("path") ?? "";
        const name = path.replaceAll("\\", "/").split("/").at(-1) ?? label;
        const type = filePreviewType(path);
        const preview = href + "&preview=1";
        return (
          <section className="message-file" key={href + index} aria-label={label || name}>
            <div className="message-file-header">
              <span title={name}>{label || name}</span>
              {type === "pdf" && (
                <a href={preview} target="_blank" rel="noopener noreferrer">
                  {t("filePreview.open")}
                </a>
              )}
              <a href={href} download={name}>
                {t("filePreview.download")}
              </a>
            </div>
            {type === "audio" && (
              <audio
                controls
                preload="none"
                src={preview}
                aria-label={label || name}
                onError={() => setFailed((current) => ({ ...current, [href]: true }))}
              />
            )}
            {type === "video" && (
              <video
                controls
                playsInline
                preload="none"
                src={preview}
                aria-label={label || name}
                onError={() => setFailed((current) => ({ ...current, [href]: true }))}
              />
            )}
            {failed[href] && <p role="alert">{t("filePreview.failed")}</p>}
          </section>
        );
      })}
    </div>
  );
};
