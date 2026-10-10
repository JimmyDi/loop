import type { Message, SessionEvent, ToolView } from "./protocol";

export const projectTools = (messages: readonly Message[]): Record<string, ToolView> => {
  const tools: Record<string, ToolView> = {};

  for (const message of messages) {
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "toolCall") {
          tools[part.id] = {
            ...tools[part.id],
            id: part.id,
            name: part.name,
            args: part.arguments,
            status: tools[part.id]?.status ?? "waiting",
          };
        }
      }
    }

    if (message.role === "toolResult") {
      const details = message.details;
      const displayName =
        details &&
        typeof details === "object" &&
        !Array.isArray(details) &&
        "loopDisplayName" in details
          ? details.loopDisplayName
          : undefined;
      tools[message.toolCallId] = {
        ...tools[message.toolCallId],
        id: message.toolCallId,
        name: message.toolName,
        ...(typeof displayName === "string" ? { displayName } : {}),
        status: message.isError ? "error" : "success",
        result: message,
      };
    }
  }

  return tools;
};

export const updateTools = (tools: Record<string, ToolView>, event: SessionEvent) => {
  if (event.type === "tool_execution_start") {
    return {
      ...tools,
      [event.toolCallId]: {
        id: event.toolCallId,
        name: event.toolName,
        ...(event.toolDisplayName ? { displayName: event.toolDisplayName } : {}),
        args: event.args,
        status: "running" as const,
      },
    };
  }

  if (event.type === "tool_execution_end") {
    const result = projectTools([event.result])[event.toolCallId]!;

    return { ...tools, [event.toolCallId]: { ...tools[event.toolCallId], ...result } };
  }

  if ("message" in event) {
    const additions = projectTools([event.message]);

    for (const [id, value] of Object.entries(additions)) {
      additions[id] = {
        ...tools[id],
        ...value,
        status: value.status === "waiting" && tools[id] ? tools[id].status : value.status,
      };
    }

    return { ...tools, ...additions };
  }

  return tools;
};
