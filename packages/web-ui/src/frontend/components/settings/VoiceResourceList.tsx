import { useTranslation } from "react-i18next";

import type { VoiceResourceListProps } from "./voice-resource-list-types";
import { voiceResourceBytes } from "./voice-resource-format";
import "./VoiceResourceList.css";

export const VoiceResourceList = ({ components, statusText }: VoiceResourceListProps) => {
  const { t } = useTranslation();
  return (
    <>
      {components?.map((component) => (
        <div className="voice-component" key={component.id}>
          <strong>
            {component.name} · {component.version}
          </strong>
          <span>{statusText ?? t("voice." + (component.installed ? "installed" : "missing"))}</span>
          <small>
            {t("voice.downloadSize")}:{" "}
            {component.downloadBytes
              ? voiceResourceBytes(component.downloadBytes)
              : t("voice.notPublished")}
          </small>
          <small>
            {t("voice.installedSize")}:{" "}
            {(component.requiredBytes ?? component.installedBytes) > 0
              ? voiceResourceBytes(component.requiredBytes ?? component.installedBytes)
              : t(component.kind === "engine" ? "voice.notPublished" : "voice.sizeUnknown")}
          </small>
          <small>
            {t("voice.diskSize")}: {voiceResourceBytes(component.installedBytes)}
          </small>
          <small>
            {t("voice.license")}: {component.license}
          </small>
        </div>
      ))}
    </>
  );
};
