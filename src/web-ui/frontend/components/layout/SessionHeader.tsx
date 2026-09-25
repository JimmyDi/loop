import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useProjects } from "../../hooks/useProjects";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { ModelSelect } from "./ModelSelect";
import "./SessionHeader.css";

export const SessionHeader = ({
  snapshot,
  connected = false,
}: {
  snapshot?: SessionSnapshot;
  connected?: boolean;
}) => {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const toggle = useWorkspace((state) => state.toggleSidebar);
  const project = projects.data?.find((project) => project.id === snapshot?.workspaceId);

  return (
    <header className="session-header">
      <ActionButton
        className="mobile-menu ghost"
        aria-label={t("openSidebar")}
        onClick={() => toggle(true)}
      >
        ☰
      </ActionButton>
      <div className="session-heading">
        <strong>{project?.name ?? "Loop"}</strong>
        <span title={project?.cwd}>{project?.cwd}</span>
      </div>
      {snapshot && <ModelSelect snapshot={snapshot} connected={connected} />}
    </header>
  );
};
