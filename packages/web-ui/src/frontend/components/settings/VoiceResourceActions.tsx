import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceResourceActionsProps } from "./voice-resource-actions-types";
import "./VoiceResourceActions.css";

export const VoiceResourceActions = ({
  status,
  profile,
  disabled,
  pending,
  active,
  loaded,
  cancellable = active,
  execute,
}: VoiceResourceActionsProps) => {
  const { t } = useTranslation();
  const unavailable = status?.engineAvailable === false;
  const paused = status?.phase === "paused";
  const installed = !paused && status?.installed === true && status.ttsInstalled === true;
  const actions = [
    {
      action: installed ? "uninstall" : "install",
      label: installed ? "uninstall" : "install",
      disabled: disabled || active || paused || !loaded || (!installed && unavailable),
      path: installed
        ? "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"
        : "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
    },
    ...(paused
      ? [
          {
            action: "install" as const,
            label: "resumeInstall",
            disabled: disabled || active || !loaded || unavailable,
            path: "m9 5 10 7-10 7V5Z",
          },
        ]
      : []),
    ...(active && cancellable
      ? [
          {
            action: "cancel" as const,
            label: "cancel",
            disabled: disabled || pending,
            path: "M6 6h12v12H6Z",
          },
        ]
      : []),
  ] as const;
  return (
    <div className="voice-settings-actions">
      {actions.map(({ action, label, disabled: blocked, path }) => (
        <span className="voice-settings-action" title={t("voice." + label)} key={label}>
          <ActionButton
            className="icon ghost"
            aria-label={t("voice." + label)}
            title={t("voice." + label)}
            disabled={blocked}
            onClick={() =>
              void execute({ action, profile: action === "install" ? "conversation" : profile })
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={path} />
            </svg>
          </ActionButton>
        </span>
      ))}
    </div>
  );
};
