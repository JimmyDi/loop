import { lazy } from "react";
import type { ComponentType } from "react";
import type { ComponentProps } from "react";

export const WorkspacePanel = lazy(() =>
  import("../components/chat/WorkspacePanel").then((module) => ({
    default: module.WorkspacePanel as ComponentType<
      ComponentProps<typeof module.WorkspacePanel<{ kind: "plan"; planId: string }>>
    >,
  })),
);

export const PanelResizer = lazy(() =>
  import("../components/chat/PanelResizer").then((module) => ({ default: module.PanelResizer })),
);

export const PanelTabs = lazy(() =>
  import("../components/chat/PanelTabs").then((module) => ({ default: module.PanelTabs })),
);
