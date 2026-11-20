export type ExecutionEnvironment =
  | { type: "local" }
  | { type: "sandbox"; url: string; tokenEnv: string }
  | { type: "sandbox"; serverId: string };

export type SandboxStatus = {
  generation: number;
  recreated: boolean;
  filesRestored: boolean;
};

export const validateExecution = (value: unknown): ExecutionEnvironment => {
  if (!value || typeof value !== "object") throw new Error("Invalid execution environment");
  const item = value as Record<string, unknown>;
  if (item.type === "local" && Object.keys(item).length === 1) return { type: "local" };
  if (
    item.type === "sandbox" &&
    typeof item.serverId === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(item.serverId) &&
    Object.keys(item).every((key) => ["type", "serverId"].includes(key))
  )
    return { type: "sandbox", serverId: item.serverId };
  if (
    item.type !== "sandbox" ||
    typeof item.url !== "string" ||
    typeof item.tokenEnv !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.tokenEnv) ||
    Object.keys(item).some((key) => !["type", "url", "tokenEnv"].includes(key))
  )
    throw new Error("Invalid sandbox environment");
  const url = new URL(item.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid sandbox URL");
  return { type: "sandbox", url: url.href, tokenEnv: item.tokenEnv };
};
