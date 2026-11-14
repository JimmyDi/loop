import { lazy } from "react";

export const PlanContentPanel = lazy(() =>
  import("../components/chat/PlanContentPanel").then((module) => ({
    default: module.PlanContentPanel,
  })),
);
