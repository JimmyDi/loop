import { useContext } from "react";

import { HistoryMediaContext } from "../../lib/history-media-context";
import "./MessageThumbnail.css";

export const MessageThumbnail = ({ src, alt }: { src: string; alt: string }) => {
  const paused = useContext(HistoryMediaContext);
  return (
    <img
      className="message-thumbnail"
      src={paused ? undefined : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  );
};
