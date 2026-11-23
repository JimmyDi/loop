import { join } from "node:path";
import { SessionManager } from "@loop/coding-agent";

import type { EchoData, EchoView } from "../../shared/echo";
import type { EchoStore } from "./store";

export const echoConversationView = async (
  store: EchoStore,
  data: EchoData,
): Promise<EchoView> => ({
  ...data,
  conversations: await Promise.all(
    data.conversations.map(async (chat) => {
      try {
        const session = await SessionManager.open(
          join(store.directory, "conversations", chat.id, "meta.json"),
          false,
        );
        const history = await session.readHistory();
        const recent = [...history.messages]
          .reverse()
          .find((message) => message.role === "assistant" || message.role === "user");
        const preview = recent?.content
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ")
          .trim()
          .slice(0, 160);
        return { ...chat, updatedAt: session.getHeader().updatedAt, preview };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return chat;
        throw error;
      }
    }),
  ),
});
