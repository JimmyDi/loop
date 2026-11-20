import type { SessionSnapshot } from "../../../shared/protocol";
import type { useComposerProject } from "../../hooks/useComposerProject";

import { ComposerProjectSelector } from "./ComposerProjectSelector";
import { ExecutionEnvironment } from "./ExecutionEnvironment";
import "./ComposerWorkspace.css";

export const ComposerWorkspace = ({
  snapshot,
  project,
  blocked,
}: {
  snapshot: SessionSnapshot;
  project: ReturnType<typeof useComposerProject>;
  blocked: boolean;
}) => (
  <div className="composer-workspace">
    {snapshot.state.execution !== "sandbox" && (
      <ComposerProjectSelector selection={project} disabled={blocked} />
    )}
    <ExecutionEnvironment snapshot={snapshot} editable={!blocked} />
  </div>
);
