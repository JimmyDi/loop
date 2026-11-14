import { lazy } from "react";

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
