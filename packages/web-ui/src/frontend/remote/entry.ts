import { mountRemoteBootstrap } from "./remote-bootstrap";

mountRemoteBootstrap(() =>
  Promise.all([import("../main"), import("../components/layout/AppShell")]),
);
