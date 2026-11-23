import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Computer } from "@loop/coding-agent";

import type { EchoView } from "../../../shared/echo";
import { api, command } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { ChatWorkspace } from "../chat/ChatWorkspace";
import { EchoSettings } from "./EchoSettings";
import { EchoConversationControls } from "./EchoConversationControls";
import { EchoDesktop } from "./EchoDesktop";
import { EchoAgentDialog } from "./EchoAgentDialog";
import { EchoGroupDialog } from "./EchoGroupDialog";
import { EchoConversationCard } from "./EchoConversationCard";
import "./EchoWorkspace.css";

type Dialog = "agent" | "group" | "connection";

export const EchoWorkspace = () => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const query = useQuery({
    queryKey: ["echo"],
    queryFn: () => api<EchoView>("/echo"),
    refetchInterval: 10000,
  });
  const client = useQueryClient();
  const [active, setActive] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  const [closedDesktopChat, setClosedDesktopChat] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = query.data;
  const computers = useQuery({
    queryKey: ["echo-computers"],
    queryFn: () => api<Computer[]>("/echo/computers"),
    enabled: !!data?.connection,
    retry: false,
  });
  const chat = data?.conversations.find((row) => row.id === active);
  const watchedComputerId = active === closedDesktopChat ? undefined : chat?.computerId;
  const watchedComputer = computers.data?.find((row) => row.sandbox_id === watchedComputerId);
  const setWatchedComputerId = (id?: string) => setClosedDesktopChat(id ? undefined : active);
  const resetConversation = (id: string) => {
    useSessions.setState((state) => ({
      views: Object.fromEntries(Object.entries(state.views).filter(([key]) => key !== id)),
    }));
    client.removeQueries({ queryKey: ["session", id], exact: true });
  };
  const createConversation = async (name: string, agentIds: string[]) => {
    const created = await command<{ id: string }>("/echo/conversations", {
      name,
      agentIds,
    });
    setActive(created.id);
    await client.invalidateQueries({ queryKey: ["echo"] });
  };
  const openPrivateChat = async (name: string, id: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await createConversation(name, [id]);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="echo-workspace">
      <aside className="echo-sidebar">
        <header>
          <h1>Echo</h1>
          <button type="button" onClick={() => setDialog("connection")}>
            {zh ? "连接" : "Connection"}
          </button>
        </header>
        <div className="echo-sidebar-section">
          <h2>Agents</h2>
          <button type="button" onClick={() => setDialog("agent")}>
            {zh ? "新建 Agent" : "New Agent"}
          </button>
        </div>
        {data?.agents.map((agent) => {
          const privateChat = data.conversations.find(
            (row) => row.agentIds.length === 1 && row.agentIds[0] === agent.id,
          );
          return (
            <EchoConversationCard
              key={agent.id}
              name={agent.name}
              avatar={agent.avatar}
              preview={privateChat?.preview}
              updatedAt={privateChat?.updatedAt}
              selected={active === privateChat?.id}
              onClick={() => void openPrivateChat(agent.name, agent.id)}
            />
          );
        })}
        <div className="echo-sidebar-section">
          <h2>{zh ? "对话" : "Conversations"}</h2>
          <button
            type="button"
            disabled={(data?.agents.length ?? 0) < 2}
            onClick={() => setDialog("group")}
          >
            {zh ? "新建群聊" : "New group chat"}
          </button>
        </div>
        {data?.conversations
          .filter((row) => row.agentIds.length > 1)
          .map((row) => (
            <EchoConversationCard
              key={row.id}
              name={row.name}
              group
              preview={row.preview}
              updatedAt={row.updatedAt}
              selected={active === row.id}
              onClick={() => setActive(row.id)}
            />
          ))}
        {(error || query.error) && <p role="alert">{error || String(query.error)}</p>}
      </aside>
      <section className="echo-content">
        {chat && data ? (
          <>
            <EchoConversationControls
              chat={chat}
              data={data}
              watchedComputerId={watchedComputerId}
              onWatch={setWatchedComputerId}
              onChanged={() => {
                for (const conversation of data.conversations) resetConversation(conversation.id);
                void client.invalidateQueries({ queryKey: ["echo"] });
              }}
            />
            <div className="echo-conversation-layout">
              <div className="echo-chat-column">
                <ChatWorkspace key={chat.id + chat.responderId + chat.computerId} id={chat.id} />
              </div>
              {chat.computerId === watchedComputerId && watchedComputer && (
                <EchoDesktop
                  computerId={watchedComputerId}
                  state={watchedComputer.state}
                  onClose={() => setWatchedComputerId(undefined)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="echo-welcome">
            <h1>Echo</h1>
            <p>
              {zh
                ? "创建 Agent，开始单聊或群聊。"
                : "Create an Agent to start a private or group conversation."}
            </p>
          </div>
        )}
      </section>
      {dialog === "agent" && (
        <EchoAgentDialog
          onClose={() => setDialog(undefined)}
          onCreated={() => {
            setDialog(undefined);
            void client.invalidateQueries({ queryKey: ["echo"] });
          }}
        />
      )}
      {dialog === "group" && data && (
        <EchoGroupDialog
          agents={data.agents}
          onClose={() => setDialog(undefined)}
          onCreate={async (name, agentIds) => {
            await createConversation(name, agentIds);
            setDialog(undefined);
          }}
        />
      )}
      {dialog === "connection" && (
        <EchoSettings
          connection={data?.connection}
          onClose={() => setDialog(undefined)}
          onSaved={() => {
            for (const conversation of data?.conversations ?? [])
              resetConversation(conversation.id);
            void client.invalidateQueries({ queryKey: ["echo-computers"] });
            void client.invalidateQueries({ queryKey: ["echo"] });
            setDialog(undefined);
          }}
        />
      )}
    </div>
  );
};
