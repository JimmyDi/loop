import { useTranslation } from "react-i18next";

import { SetupStepMarker } from "../ui/SetupStepMarker";
import type { SetupStepMarkerProps } from "../ui/setup-step-marker-types";

import "./RemoteAccessMarker.css";

export const RemoteAccessMarker = ({
  complete,
  loading,
  failed,
}: Omit<SetupStepMarkerProps, "label" | "className">) => {
  const { t } = useTranslation();
  const state = loading ? "loading" : failed ? "failed" : complete ? "completed" : "incomplete";
  return (
    <SetupStepMarker
      className="remote-access-marker"
      complete={complete}
      loading={loading}
      failed={failed}
      label={t("remote." + state)}
    />
  );
};
