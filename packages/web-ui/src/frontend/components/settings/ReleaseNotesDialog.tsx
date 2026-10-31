import { useTranslation } from "react-i18next";

import { releaseNotesUrl } from "../../lib/release-links";
import { releaseMarkdown } from "../../lib/release-markdown";
import { MarkdownText } from "../chat/MarkdownText";
import { Modal } from "../ui/Modal";
import "./ReleaseNotesDialog.css";

export const ReleaseNotesDialog = ({
  release,
  onClose,
}: {
  release: { version: string; date: string; title: string; notes: string };
  onClose(): void;
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      title={release.title}
      onClose={onClose}
      closeLabel={t("close")}
      className="release-notes-dialog"
    >
      <div className="release-notes-meta">
        <time dateTime={release.date}>{release.date}</time>
        <span>v{release.version}</span>
      </div>
      <div className="release-notes-body">
        <MarkdownText text={releaseMarkdown(release.notes, release.version)} />
      </div>
      <a
        className="release-notes-link"
        href={releaseNotesUrl(release.version)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("helpUpdates.versionPage")} ↗
      </a>
    </Modal>
  );
};
