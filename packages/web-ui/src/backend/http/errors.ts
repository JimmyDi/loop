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
      code: error instanceof HttpError ? error.code : "operation_failed",
      message: errorText(error),
    },
    { status: error instanceof HttpError ? error.status : 500 },
  );
