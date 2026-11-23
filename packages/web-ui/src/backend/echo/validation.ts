import type { EchoData } from "../../shared/echo";

const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

export const validateEchoData = (input: unknown): EchoData => {
  const data = input as EchoData;
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.agents) ||
    !Array.isArray(data.conversations)
  )
    throw new Error("Invalid Echo storage");
  if (
    data.agents.some(
      (agent) =>
        !agent ||
        !id(agent.id) ||
        !text(agent.name, 80) ||
        !agent.name.trim() ||
        !text(agent.instructions, 16000) ||
        (agent.avatar !== undefined &&
          (typeof agent.avatar !== "string" ||
            !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(agent.avatar) ||
            agent.avatar.length > 350_000)),
    )
  )
    throw new Error("Invalid Echo Agent");
  if (new Set(data.agents.map((agent) => agent.id)).size !== data.agents.length)
    throw new Error("Duplicate Echo Agent");
  if (
    data.conversations.some(
      (chat) =>
        !chat ||
        !id(chat.id) ||
        !text(chat.name, 120) ||
        !Array.isArray(chat.agentIds) ||
        !chat.agentIds.length ||
        chat.agentIds.length > 16 ||
        new Set(chat.agentIds).size !== chat.agentIds.length ||
        chat.agentIds.some((id) => !data.agents.some((agent) => agent.id === id)) ||
        !chat.agentIds.includes(chat.responderId) ||
        (chat.privateAgentId !== undefined &&
          (!id(chat.privateAgentId) || !chat.agentIds.includes(chat.privateAgentId))) ||
        (chat.computerId !== undefined && !/^[a-f0-9]{32}$/.test(chat.computerId)),
    )
  )
    throw new Error("Invalid Echo conversation");
  if (new Set(data.conversations.map((chat) => chat.id)).size !== data.conversations.length)
    throw new Error("Duplicate Echo conversation");
  if (
    data.connection &&
    (data.connection.provider !== "loop-sandbox" ||
      !text(data.connection.endpoint, 8192) ||
      typeof data.connection.desktop !== "boolean" ||
      !Number.isInteger(data.connection.idleSeconds) ||
      data.connection.idleSeconds < 60 ||
      data.connection.idleSeconds > 86400)
  )
    throw new Error("Invalid Echo connection");
  return data;
};
