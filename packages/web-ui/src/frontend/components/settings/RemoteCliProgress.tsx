import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { RemoteAccessStatus } from "../../../shared/remote-access";
import { ActionButton } from "../ui/ActionButton";
import "./RemoteCliProgress.css";

export const RemoteCliProgress = ({
  activity,
  download,
  onTogglePause,
  onCancel,
  controlsDisabled,
  pauseDisabled,
}: {
  activity?: "uninstalling" | "signing-in" | "signing-out" | "connecting" | "stopping";
  download?: RemoteAccessStatus["download"];
  onTogglePause?: () => void;
  onCancel?: () => void;
  controlsDisabled?: boolean;
  pauseDisabled?: boolean;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const received = Math.max(0, download?.received ?? 0);
  const total = download?.total;
  const verifying = download?.stage === "verifying";
  const full = !!activity || verifying;
  const paused = !full && !!download?.paused;
  const percent = !full && total && total > 0 ? Math.min(100, (received / total) * 100) : undefined;
  const message = activity
    ? t("remote.phases." + activity)
    : verifying
      ? t("remote.verifyingAndInstalling")
      : paused
        ? t("remote.downloadPaused")
        : download
          ? t("remote.download", {
              received: (received / 1048576).toFixed(1),
              total: total ? (total / 1048576).toFixed(1) : "?",
            })
          : t("remote.phases.installing");

  return (
    <div className="remote-cli-progress" data-paused={paused} data-activity={!!activity}>
      <div
        className="remote-cli-progress-track"
        role="progressbar"
        aria-label={t(
          "remote." +
            (activity
              ? {
                  uninstalling: "uninstall",
                  "signing-in": "login",
                  "signing-out": "logout",
                  connecting: "start",
                  stopping: "disconnect",
                }[activity]
              : "install"),
        )}
        title={message}
        aria-describedby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={message}
        data-indeterminate={!full && percent === undefined}
      >
        <div
          className="remote-cli-progress-fill"
          style={{ width: full ? "100%" : percent === undefined ? "28%" : percent + "%" }}
        />
      </div>
      {!activity && (
        <span className="remote-cli-progress-percent" aria-hidden="true">
          {percent === undefined ? "—" : Math.floor(percent) + "%"}
        </span>
      )}
      <span id={id} role="status" className="sr-only">
        {message}
      </span>
      {[
        {
          action: "pause",
          onClick: full ? undefined : onTogglePause,
          label: paused ? "resumeDownload" : "pauseDownload",
          path: paused ? "m9 5 11 7-11 7Z" : "M8 5v14M16 5v14",
          disabled: controlsDisabled || pauseDisabled,
        },
        {
          action: "stop",
          onClick: activity ? undefined : onCancel,
          label: verifying ? "stop" : "stopDownload",
          path: "M6 6h12v12H6Z",
          disabled: controlsDisabled,
        },
      ].map(
        ({ action, onClick, label, path, disabled }) =>
          onClick && (
            <span
              className="remote-cli-progress-action"
              data-action={action}
              key={action}
              title={t("remote." + label)}
            >
              <ActionButton
                className="icon ghost"
                aria-label={t("remote." + label)}
                title={t("remote." + label)}
                disabled={disabled}
                onClick={onClick}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d={path} />
                </svg>
              </ActionButton>
            </span>
          ),
      )}
    </div>
  );
};
