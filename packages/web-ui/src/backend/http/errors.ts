import { NothingToCompactError } from "@loop/coding-agent";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const errorResponse = (error: unknown): Response =>
  Response.json(
    {
      code:
        error instanceof HttpError
          ? error.code
          : error instanceof NothingToCompactError
            ? "nothing_to_compact"
            : "operation_failed",
      message: errorText(error),
    },
    {
      status:
        error instanceof HttpError
          ? error.status
          : error instanceof NothingToCompactError
            ? 400
            : 500,
    },
  );
