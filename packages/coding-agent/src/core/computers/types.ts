export type Computer = {
  sandbox_id: string;
  state: string;
  generation: number;
  desktop: boolean;
  idle_seconds: number;
};

export type ComputerActor = {
  conversation_id: string;
  agent_id: string;
  execution_id: string;
};

export type ComputerOperation = {
  request_id: string;
  generation: number;
  actor: ComputerActor;
  name: string;
  arguments: Record<string, unknown>;
  lease_id?: string;
};

export type ComputerResult = {
  status: "running" | "unknown" | "succeeded" | "failed";
  result?: Record<string, unknown>;
  error?: { message?: string };
};

export interface ComputerProvider {
  list(signal?: AbortSignal): Promise<Computer[]>;
  create(requestId: string, desktop: boolean, idleSeconds: number): Promise<Computer>;
  power(id: string, action: "start" | "stop" | "rebuild"): Promise<Computer>;
  destroy(id: string): Promise<void>;
  bind(id: string, conversationId: string): Promise<void>;
  inspect(id: string, signal?: AbortSignal): Promise<Computer>;
  execute(id: string, operation: ComputerOperation, signal: AbortSignal): Promise<ComputerResult>;
  status(id: string, requestId: string, signal: AbortSignal): Promise<ComputerResult>;
  acquire(id: string, holder: string, signal: AbortSignal): Promise<{ lease_id: string }>;
  release(id: string, leaseId: string): Promise<void>;
  download(
    id: string,
    conversationId: string,
    path: string,
    signal: AbortSignal,
  ): Promise<Response>;
  preview(id: string, signal: AbortSignal): Promise<Response>;
}
