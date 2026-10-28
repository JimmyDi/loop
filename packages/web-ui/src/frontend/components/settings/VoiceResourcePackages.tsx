import { useTranslation } from "react-i18next";

import { voiceErrorKey } from "../../voice/errors";
import { VoicePackageProgress } from "./VoicePackageProgress";
import type { VoiceResourcePackagesProps } from "./voice-resource-packages-types";
import { VoiceResourceInfo } from "./VoiceResourceInfo";
import "./VoiceResourcePackages.css";

export const VoiceResourcePackages = ({ status }: VoiceResourcePackagesProps) => {
  const { t } = useTranslation();
  return (
    <div className="voice-resource-packages" role="group" aria-label={t("voice.installResources")}>
      {status?.components?.map((component) => {
        const operation = status.packages?.[component.id];
        const loading = operation?.phase === "installing";
        const failed = operation?.phase === "error";
        const state = loading
          ? "loading"
          : failed
            ? "checkFailed"
            : component.installed || operation?.phase === "completed"
              ? "completed"
              : "incomplete";
        const label = component.name + ": " + t("voice." + state);
        return (
          <div className="voice-resource-package" key={component.id}>
            <VoicePackageProgress
              complete={component.installed || operation?.phase === "completed"}
              loading={loading}
              failed={failed}
              error={failed ? t(voiceErrorKey(operation?.error ?? status.error)) : undefined}
              label={label}
              received={operation?.received}
              total={operation?.total}
            />
            <div className="voice-resource-package-caption">
              <span className="voice-resource-package-name" title={component.name}>
                {component.name}
              </span>
              <VoiceResourceInfo
                component={component}
                statusText={t("voice." + state)}
                error={failed ? t(voiceErrorKey(operation?.error ?? status.error)) : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
