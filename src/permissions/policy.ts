import type { Capability, Tool } from "../extensions/types";

export type CapabilityPolicy = { allowed?: Capability[]; approvalRequired?: Capability[] };

export const capabilityFor = (tool: Tool): Capability[] => tool.capabilities ?? ["read"];

export const requiresApproval = (tool: Tool, policy: CapabilityPolicy = {}): boolean => {
  const approval = new Set(
    policy.approvalRequired ?? ["write", "network", "shell", "external_service"],
  );
  return capabilityFor(tool).some(
    (capability) => approval.has(capability) && !(policy.allowed ?? []).includes(capability),
  );
};

export const validateCapabilities = (tool: Tool, policy: CapabilityPolicy = {}): void => {
  const allowed = policy.allowed ?? ["read", "write", "network", "shell", "external_service"];
  const missing = capabilityFor(tool).filter((capability) => !allowed.includes(capability));
  if (missing.length)
    throw new Error("Capability denied for " + tool.name + ": " + missing.join(", "));
};
