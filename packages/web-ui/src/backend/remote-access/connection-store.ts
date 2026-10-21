import { BooleanStateStore } from "./boolean-state-store";

/** Reconnect preference only; a live host and address are never restored from disk. */
export class ConnectionStore extends BooleanStateStore {
  constructor(file: string) {
    super(file, "enabled", "connection_state_failed");
  }
}
