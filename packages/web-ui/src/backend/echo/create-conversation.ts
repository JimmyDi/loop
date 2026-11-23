import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SessionManager } from "@loop/coding-agent";

import type { EchoStore } from "./store";
import { HttpError } from "../http/errors";
import { requiredString } from "../http/input";

export const createEchoConversation = async (store: EchoStore, body: Record<string, unknown>) => {
  const agentIds = body.agentIds;
  const privateChat = Array.isArray(agentIds) && agentIds.length === 1;
  if (
    !Array.isArray(agentIds) ||
    !agentIds.length ||
    agentIds.length > 16 ||
    new Set(agentIds).size !== agentIds.length ||
    agentIds.some((id) => typeof id !== "string") ||
    (body.private !== undefined && typeof body.private !== "boolean") ||
    (body.private === true && agentIds.length !== 1)
  )
    throw new HttpError(400, "invalid_members");
  const members = agentIds as string[];
  const name = requiredString(body, "name").trim();
  if (name.length > 120) throw new HttpError(400, "invalid_name");
  return store.mutate(async (data) => {
    if (members.some((id) => !data.agents.some((agent) => agent.id === id)))
      throw new HttpError(400, "invalid_members");
    if (privateChat) {
      const existing = data.conversations.find(
        (row) =>
          row.privateAgentId === members[0] ||
          (row.agentIds.length === 1 && row.agentIds[0] === members[0]),
      );
      if (existing) return existing;
    }
    await mkdir(store.directory, { recursive: true, mode: 0o700 });
    const manager = await SessionManager.create(
      store.directory,
      join(store.directory, "conversations"),
    );
    const chat = {
      id: manager.getSessionId(),
      name,
      agentIds: members,
      responderId: members[0]!,
      ...(privateChat ? { privateAgentId: members[0]! } : {}),
    };
    data.conversations.push(chat);
    return chat;
  });
};
