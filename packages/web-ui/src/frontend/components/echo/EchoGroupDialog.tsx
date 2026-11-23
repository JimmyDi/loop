import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { EchoAgent } from "../../../shared/echo";
import { Modal } from "../ui/Modal";
import "./EchoDialog.css";
import "./EchoGroupDialog.css";

export const EchoGroupDialog = ({
  agents,
  onClose,
  onCreate,
}: {
  agents: EchoAgent[];
  onClose(): void;
  onCreate(name: string, agentIds: string[]): Promise<void>;
}) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return createPortal(
    <Modal
      title={zh ? "新建群聊" : "New group chat"}
      className="echo-form-dialog"
      closeLabel={zh ? "关闭" : "Close"}
      closeDisabled={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || members.length < 2) return;
          setBusy(true);
          setError("");
          const title =
            name.trim() ||
            agents
              .filter((agent) => members.includes(agent.id))
              .map((agent) => agent.name)
              .join(" · ");
          void onCreate(title, [...members])
            .catch((error) => setError(String(error)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          {zh ? "群聊名称（可选）" : "Group name (optional)"}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            disabled={busy}
          />
        </label>
        <fieldset>
          <legend>{zh ? "选择 Agent" : "Select Agents"}</legend>
          {agents.map((agent) => (
            <label key={agent.id} className="echo-group-member">
              <input
                type="checkbox"
                checked={members.includes(agent.id)}
                disabled={busy}
                onChange={(event) =>
                  setMembers(
                    event.target.checked
                      ? [...members, agent.id]
                      : members.filter((id) => id !== agent.id),
                  )
                }
              />
              {agent.name}
            </label>
          ))}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {zh ? "取消" : "Cancel"}
          </button>
          <button type="submit" disabled={busy || members.length < 2}>
            {zh ? "创建群聊" : "Create group chat"}
          </button>
        </footer>
      </form>
    </Modal>,
    document.body,
  );
};
