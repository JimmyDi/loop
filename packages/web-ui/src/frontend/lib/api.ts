export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch("/api" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new ApiError(
      body.code ?? "operation_failed",
      body.message ?? response.statusText,
      response.status,
    );
  }

  return response.status === 204 ? (undefined as T) : response.json();
};

export const command = <T>(path: string, body?: unknown, method = "POST") =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
