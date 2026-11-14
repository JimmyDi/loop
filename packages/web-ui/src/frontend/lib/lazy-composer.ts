import { lazy } from "react";

export const ChatComposer = lazy(() =>
  import("../components/chat/ChatComposer").then((module) => ({ default: module.ChatComposer })),
);
