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
  const installed = status?.installed && (profile === "input" || status.ttsInstalled);
  const actions = [
    {
      action: "install",
      label: installed ? "repair" : "install",
      disabled: disabled || active || unavailable,
      path: installed
        ? "m9 12 2 2 4-4M12 3l8 3v5c0 5-8 10-8 10S4 16 4 11V6Z"
        : "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
    },
    {
      action: "update",
      label: "update",
      disabled: disabled || active || !status?.installed || unavailable || !status.updateAvailable,
      path: "M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17",
    },
    {
      action: "uninstall",
      label: "uninstall",
      disabled: disabled || active || !loaded,
      path: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    },
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
        <span className="voice-settings-action" title={t("voice." + label)} key={action}>
          <ActionButton
            className="icon ghost"
            aria-label={t("voice." + label)}
            title={t("voice." + label)}
            disabled={blocked}
            onClick={() => void execute({ action, profile })}
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
