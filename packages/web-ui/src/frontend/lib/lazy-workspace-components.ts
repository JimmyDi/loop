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

export const ChatComposer = lazy(() =>
  import("../components/chat/ChatComposer").then((module) => ({ default: module.ChatComposer })),
);
export const SessionApprovals = lazy(() =>
  import("../components/chat/SessionApprovals").then((module) => ({
    default: module.SessionApprovals,
  })),
);

export const UserInputCard = lazy(() =>
  import("../components/chat/UserInputCard").then((module) => ({ default: module.UserInputCard })),
);

export const PlanReviewCard = lazy(() =>
  import("../components/chat/PlanReviewCard").then((module) => ({
    default: module.PlanReviewCard,
  })),
);

export const PlanContentPanel = lazy(() =>
  import("../components/chat/PlanContentPanel").then((module) => ({
    default: module.PlanContentPanel,
  })),
);
