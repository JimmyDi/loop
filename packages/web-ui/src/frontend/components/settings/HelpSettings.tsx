import { useState } from "react";
import { useTranslation } from "react-i18next";
import content from "virtual:loop-releases";

import { releaseDocsUrl, releaseNotesUrl } from "../../lib/release-links";
import { ReleaseNotesDialog } from "./ReleaseNotesDialog";
import "./HelpSettings.css";

export const HelpSettings = () => {
  const { t } = useTranslation();
  const [release, setRelease] = useState<(typeof content.releases)[number]>();
  return (
    <div className="help-settings">
      <h3>{t("help")}</h3>
      <a href={releaseDocsUrl()} target="_blank" rel="noopener noreferrer">
        {t("helpUpdates.docs")} ↗
      </a>
      <h4>{t("helpUpdates.recent")}</h4>
      <div className="help-release-list">
        {content.releases.map((entry) => (
          <button type="button" key={entry.version} onClick={() => setRelease(entry)}>
            <span>{entry.title}</span>
            <time dateTime={entry.date}>{entry.date}</time>
          </button>
        ))}
      </div>
      <a href={releaseNotesUrl()} target="_blank" rel="noopener noreferrer">
        {t("helpUpdates.all")} ↗
      </a>
      {release && <ReleaseNotesDialog release={release} onClose={() => setRelease(undefined)} />}
    </div>
  );
};
