import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useImageGestures } from "../../hooks/useImageGestures";

import { MessageThumbnail } from "./MessageThumbnail";
import { Modal } from "../ui/Modal";
import "./MessageImageGallery.css";

export type MessageImage = { src: string; alt: string };

export const MessageImageGallery = ({ images }: { images: MessageImage[] }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number>();
  const [failed, setFailed] = useState<string>();
  const image = selected === undefined ? undefined : images[selected];
  const { ref, zoomed, toggle } = useImageGestures(image?.src);
  const select = (index: number) => {
    setSelected(index);
    setFailed(undefined);
  };
  if (!images.length) return null;
  return (
    <div className="message-image-gallery">
      <div className="message-image-thumbnails" role="group" aria-label={t("imagePreview.images")}>
        {images.map((item, index) => (
          <button
            key={item.src + ":" + index}
            type="button"
            className="message-image-thumbnail"
            aria-label={t("imagePreview.open", { index: index + 1 })}
            onClick={() => select(index)}
          >
            <MessageThumbnail src={item.src} alt={item.alt} />
          </button>
        ))}
      </div>
      {image && selected !== undefined && (
        <Modal
          title={t("imagePreview.title")}
          closeLabel={t("close")}
          className="message-image-preview"
          onClose={() => setSelected(undefined)}
        >
          <div
            ref={ref}
            className="message-image-viewer"
            data-zoomed={zoomed}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" && selected > 0) {
                event.preventDefault();
                select(selected - 1);
              } else if (event.key === "ArrowRight" && selected < images.length - 1) {
                event.preventDefault();
                select(selected + 1);
              }
            }}
          >
            {failed === image.src ? (
              <p role="alert">{t("imagePreview.failed")}</p>
            ) : (
              <button
                type="button"
                className="message-image-canvas"
                aria-label={t(zoomed ? "imagePreview.fit" : "imagePreview.actual")}
                aria-pressed={zoomed}
                onClick={toggle}
              >
                <img
                  key={image.src}
                  src={image.src}
                  alt={image.alt}
                  decoding="async"
                  draggable={false}
                  onError={() => setFailed(image.src)}
                />
              </button>
            )}
          </div>
          <div className="message-image-controls">
            <button
              type="button"
              disabled={selected === 0}
              onClick={() => select(selected - 1)}
              aria-label={t("imagePreview.previous")}
            >
              <span aria-hidden="true">←</span>
            </button>
            <span role="status">
              {selected + 1} / {images.length}
            </span>
            <button
              type="button"
              disabled={selected === images.length - 1}
              onClick={() => select(selected + 1)}
              aria-label={t("imagePreview.next")}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
