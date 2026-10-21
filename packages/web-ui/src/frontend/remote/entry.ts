import { mountRemoteBootstrap } from "./remote-bootstrap";

mountRemoteBootstrap(() => import("../main"));
