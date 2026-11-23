import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { EchoConversation, EchoData } from "../../../shared/echo";
import type { Computer } from "@loop/coding-agent";
import { api, command } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { EchoComputerDeleteDialog } from "./EchoComputerDeleteDialog";
import "./EchoConversationControls.css";

export const EchoConversationControls = ({
  chat,
  data,
  onChanged,
  watchedComputerId,
  onWatch,
}: {
  chat: EchoConversation;
  data: EchoData;
  onChanged(): void;
  watchedComputerId?: string;
  onWatch(computerId?: string): void;
}) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const client = useQueryClient();
  const computers = useQuery({
    queryKey: ["echo-computers"],
    queryFn: () => api<Computer[]>("/echo/computers"),
    enabled: !!data.connection,
    retry: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [deleteError, setDeleteError] = useState("");
  const running = useSessions((state) => state.views[chat.id]?.snapshot?.operation === "prompt");
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["echo-computers"] });
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const update = async (body: unknown) => {
    await command("/echo/conversations/" + chat.id, body, "PUT");
    useSessions.getState().connection(chat.id, false);
    onChanged();
  };
  const computer = computers.data?.find((row) => row.sandbox_id === chat.computerId);
  const deleteComputer = async () => {
    setBusy(true);
    setDeleteError("");
    try {
      await command("/echo/computers/" + deleting, undefined, "DELETE");
      onWatch(undefined);
      onChanged();
      await client.invalidateQueries({ queryKey: ["echo-computers"] });
      setDeleting(undefined);
    } catch (error) {
      setDeleteError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const togglePower = async () => {
    await act(async () => {
      await command(
        "/echo/computers/" +
          computer.sandbox_id +
          "/" +
          (computer.state === "running" ? "stop" : "start"),
      );
    });
  };
  return (
    <div className="echo-controls">
      <label>
        {zh ? "回复 Agent" : "Reply as"}
        <select
          disabled={busy || running}
          value={chat.responderId}
          onChange={(event) => void act(() => update({ responderId: event.target.value }))}
        >
          {chat.agentIds.map((id) => (
            <option value={id} key={id}>
              {data.agents.find((agent) => agent.id === id)?.name}
            </option>
          ))}
        </select>
      </label>
      {chat.agentIds.length > 1 && (
        <label>
          {zh ? "邀请 Agent" : "Invite Agent"}
          <select
            disabled={busy || running}
            value=""
            onChange={(event) =>
              void act(() => update({ agentIds: [...chat.agentIds, event.target.value] }))
            }
          >
            <option value="">{zh ? "选择" : "Select"}</option>
            {data.agents
              .filter((agent) => !chat.agentIds.includes(agent.id))
              .map((agent) => (
                <option value={agent.id} key={agent.id}>
                  {agent.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        {zh ? "电脑" : "Computer"}
        <select
          disabled={busy || running || !data.connection}
          value={chat.computerId ?? ""}
          onChange={(event) => void act(() => update({ computerId: event.target.value }))}
        >
          <option value="" disabled>
            {zh ? "选择电脑" : "Select computer"}
          </option>
          {computers.data?.map((row) => (
            <option value={row.sandbox_id} key={row.sandbox_id}>
              {row.sandbox_id.slice(0, 8)} · {row.state}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || running || !data.connection}
        onClick={() =>
          void act(async () => {
            const created = await command<Computer>("/echo/computers", {
              requestId: crypto.randomUUID(),
            });
            await update({ computerId: created.sandbox_id });
          })
        }
      >
        {zh ? "新电脑" : "New computer"}
      </button>
      {computer && (
        <button type="button" disabled={busy || running} onClick={() => void togglePower()}>
          {computer.state === "running" ? (zh ? "停止" : "Stop") : zh ? "启动" : "Start"}
        </button>
      )}
      {computer && (
        <button
          type="button"
          disabled={busy || running}
          onClick={() => setDeleting(computer.sandbox_id)}
        >
          {zh ? "删除电脑" : "Delete computer"}
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => void computers.refetch()}>
        {zh ? "刷新" : "Refresh"}
      </button>
      {computer?.desktop && (
        <button
          type="button"
          aria-pressed={watchedComputerId === computer.sandbox_id}
          onClick={() =>
            onWatch(watchedComputerId === computer.sandbox_id ? undefined : computer.sandbox_id)
          }
        >
          {watchedComputerId === computer.sandbox_id
            ? zh
              ? "关闭桌面"
              : "Close desktop"
            : zh
              ? "观看桌面"
              : "Watch desktop"}
        </button>
      )}
      {(error || computers.error) && <span role="alert">{error || String(computers.error)}</span>}
      {deleting && (
        <EchoComputerDeleteDialog
          computerId={deleting}
          pending={busy}
          error={deleteError}
          onClose={() => {
            setDeleting(undefined);
            setDeleteError("");
          }}
          onConfirm={() => void deleteComputer()}
        />
      )}
    </div>
  );
};
