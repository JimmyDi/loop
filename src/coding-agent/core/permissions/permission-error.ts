export class PermissionError extends Error {
  readonly code = "PERMISSION_DENIED";

  constructor(message: string) {
    super(
      "PERMISSION_DENIED: " +
        message +
        ". Approval is unavailable; this operation was not authorized.",
    );
    this.name = "PermissionError";
  }
}
