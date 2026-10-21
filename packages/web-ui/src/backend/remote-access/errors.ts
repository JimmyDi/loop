import type { RemoteAccessErrorCode } from "../../shared/remote-access";

export class RemoteAccessError extends Error {
  constructor(readonly code: RemoteAccessErrorCode) {
    super(code);
  }
}
