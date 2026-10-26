import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceDownloadProgressProps } from "./voice-download-progress-types";
import { voiceResourceBytes } from "./voice-resource-format";
import "./VoiceDownloadProgress.css";

export const VoiceDownloadProgress = ({
  download,
  activity = "installing",
}: VoiceDownloadProgressProps) => {
  const { t } = useTranslation();
  const id = useId();
  const received = Math.max(0, download?.received ?? 0);
  const total = download?.total;
  const knownTotal = total !== undefined && Number.isFinite(total) && total > 0;
  const percent = knownTotal ? Math.min(100, (received / total) * 100) : undefined;
  const label = t("voice." + activity);
  const message = download
    ? label +
      " " +
      voiceResourceBytes(received) +
      (knownTotal ? " / " + voiceResourceBytes(total) : "")
    : label;

  return (
    <div className="voice-download-progress">
      <div
        className="voice-download-progress-track"
        role="progressbar"
        aria-label={label}
        aria-describedby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={message}
        title={message}
        data-indeterminate={percent === undefined}
      >
        <div
          className="voice-download-progress-fill"
          style={{ width: percent === undefined ? "28%" : percent + "%" }}
        />
      </div>
      <span className="voice-download-progress-percent" aria-hidden="true">
        {percent === undefined ? "—" : Math.floor(percent) + "%"}
      </span>
      <span id={id} role="status" className="sr-only">
        {message}
      </span>
    </div>
  );
};
