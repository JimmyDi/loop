import type { Computer, ComputerOperation, ComputerProvider, ComputerResult } from "./types";

export class LoopSandboxProvider implements ComputerProvider {
  private readonly endpoint: string;

  private async binary(path: string, signal: AbortSignal): Promise<Response> {
    try {
      const response = await fetch(this.endpoint + "/echo/computers" + path, {
        headers: { Authorization: "Bearer " + this.token },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      });
      if (!response.ok) throw new Error();
      return response;
    } catch {
      throw new Error("Computer download unavailable");
    }
  }

  download(id: string, conversationId: string, path: string, signal: AbortSignal) {
    return this.binary(
      "/" +
        encodeURIComponent(id) +
        "/download?" +
        new URLSearchParams({ conversation_id: conversationId, path }),
      signal,
    );
  }

  preview(id: string, signal: AbortSignal) {
    return this.binary("/" + encodeURIComponent(id) + "/preview", signal);
  }

  constructor(
    endpoint: string,
    private readonly token: string,
    private readonly timeoutMs = 60000,
  ) {
    const url = new URL(endpoint);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid computer endpoint");
    this.endpoint = url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
  }

  async request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint + "/echo/computers" + path, {
        method,
        redirect: "error",
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(signal ? [signal] : [])]),
      });
    } catch {
      throw new Error(
        "Computer connection failed; delivery may be unknown. No retry was performed.",
      );
    }
    if (!response.ok) throw new Error("Computer request rejected (" + response.status + ").");
    return response.status === 204 || !response.headers.get("content-type")?.includes("json")
      ? (undefined as T)
      : (response.json() as Promise<T>);
  }

  list(signal?: AbortSignal) {
    return this.request<Computer[]>("", "GET", undefined, signal);
  }
  inspect(id: string, signal?: AbortSignal) {
    return this.request<Computer>("/" + encodeURIComponent(id), "GET", undefined, signal);
  }
  create(requestId: string, desktop: boolean, idleSeconds: number) {
    return this.request<Computer>("", "POST", {
      request_id: requestId,
      desktop,
      idle_seconds: idleSeconds,
    });
  }
  power(id: string, action: "start" | "stop" | "rebuild") {
    return this.request<Computer>("/" + encodeURIComponent(id) + "/" + action, "POST");
  }
  async destroy(id: string): Promise<void> {
    await this.request("/" + encodeURIComponent(id), "DELETE");
  }
  async bind(id: string, conversationId: string) {
    await this.request("/" + encodeURIComponent(id) + "/bindings", "PUT", {
      conversation_id: conversationId,
    });
  }
  execute(id: string, operation: ComputerOperation, signal: AbortSignal) {
    return this.request<ComputerResult>(
      "/" + encodeURIComponent(id) + "/operations",
      "POST",
      operation,
      signal,
    );
  }
  status(id: string, requestId: string, signal: AbortSignal) {
    return this.request<ComputerResult>(
      "/" + encodeURIComponent(id) + "/operations/" + encodeURIComponent(requestId),
      "GET",
      undefined,
      signal,
    );
  }
  acquire(id: string, holder: string, signal: AbortSignal) {
    return this.request<{ lease_id: string }>(
      "/" + encodeURIComponent(id) + "/lease",
      "POST",
      { holder, kind: "agent", seconds: 120 },
      signal,
    );
  }
  async release(id: string, leaseId: string) {
    await this.request(
      "/" + encodeURIComponent(id) + "/lease/" + encodeURIComponent(leaseId),
      "DELETE",
    );
  }
}
