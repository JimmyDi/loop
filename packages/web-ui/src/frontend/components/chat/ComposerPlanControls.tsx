import type { SessionSnapshot } from "../../../shared/protocol";
import type { PermissionPreset } from "../../../shared/protocol";

import { ComposerAddMenu } from "./ComposerAddMenu";
import { PlanModeItem } from "./PlanModeItem";
import { SessionPermissions } from "./SessionPermissions";
import "./ComposerPlanControls.css";

export const ComposerPlanControls = ({
  snapshot,
  blocked,
  running,
  imageCount,
  fileCount,
  add,
  planning,
  permission,
}: {
  snapshot: SessionSnapshot;
  blocked: boolean;
  running: boolean;
  imageCount: number;
  fileCount: number;
  add(files: File[]): void;
  planning: { change(active: boolean): void };
  permission: {
    pending: boolean;
    error?: unknown;
    change(preset: PermissionPreset): Promise<boolean>;
  };
}) => (
  <>
    <ComposerAddMenu
      disabled={blocked}
      imageCount={imageCount}
      fileCount={fileCount}
      add={add}
      plan={{
        active: snapshot.state.planning?.mode === "plan",
        disabled: blocked || running,
        change: planning.change,
      }}
    />
    <SessionPermissions
      snapshot={snapshot}
      disabled={blocked || running}
      pending={permission.pending}
      error={permission.error}
      select={permission.change}
    />
    <PlanModeItem
      active={snapshot.state.planning?.mode === "plan"}
      disabled={blocked || running}
      change={planning.change}
    />
  </>
);
