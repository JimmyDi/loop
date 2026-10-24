import { checkRemoteSession, remoteCsrfHeaders } from "./remote-session";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch("/api" + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...remoteCsrfHeaders(init?.method),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !path.startsWith("/remote-"))
      checkRemoteSession();
    const body = await response.json().catch(() => ({}));

    throw new ApiError(
      body.code ?? "operation_failed",
      body.message ?? response.statusText,
      response.status,
    );
  }

  return response.status === 204 ? (undefined as T) : response.json();
};

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!["GET", "HEAD"].includes(init?.method?.toUpperCase() ?? "GET") && !path.endsWith("/prompt"))
    return request<T>(path, init);
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Request timed out; delivery may be unconfirmed."));
      abort.abort();
    }, 30_000);
  });
  try {
    return await Promise.race([
      request<T>(path, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, abort.signal]) : abort.signal,
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const command = <T>(path: string, body?: unknown, method = "POST") =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
