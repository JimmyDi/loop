import type { Provider } from "../providers/types";
import type { ExtensionRegistry } from "../extensions/registry";
import type { CapabilityPolicy } from "../permissions/policy";

export type RunEvent =
  | { type: "run_started"; runId: string; prompt: string }
  | { type: "model_response"; text: string }
  | { type: "tool_started"; name: string; input: Record<string, unknown> }
  | { type: "tool_finished"; name: string; output: string }
  | { type: "approval_required"; name: string; capabilities: string[] }
  | { type: "run_completed"; output: string }
  | { type: "run_failed"; error: string };

export type RuntimeOptions = {
  provider: Provider;
  model: string;
  registry?: ExtensionRegistry;
  policy?: CapabilityPolicy;
  maxSteps?: number;
  signal?: AbortSignal;
  onEvent?: (event: RunEvent) => void;
};
