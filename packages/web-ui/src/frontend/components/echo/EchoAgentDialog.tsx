import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { command } from "../../lib/api";
import { Modal } from "../ui/Modal";
import "./EchoDialog.css";
import "./EchoAgentDialog.css";

export const EchoAgentDialog = ({ onClose, onCreated }: { onClose(): void; onCreated(): void }) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [avatar, setAvatar] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return createPortal(
    <Modal
      title={zh ? "新建 Agent" : "New Agent"}
      className="echo-form-dialog"
      closeLabel={zh ? "关闭" : "Close"}
      closeDisabled={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          void command("/echo/agents", {
            name: name.trim(),
            instructions,
            ...(avatar ? { avatar } : {}),
          })
            .then(onCreated)
            .catch((error) => setError(String(error)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          {zh ? "Agent 名称" : "Agent name"}
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={busy}
          />
        </label>
        <label>
          {zh ? "个性与职责" : "Personality and responsibilities"}
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={16000}
            rows={5}
            disabled={busy}
          />
        </label>
        <label>
          {zh ? "头像（可选）" : "Avatar (optional)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                setAvatar(undefined);
                return;
              }
              if (
                !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
                file.size > 256_000
              ) {
                setError(
                  zh
                    ? "请选择 256 KB 以下的 PNG、JPEG 或 WebP 图片"
                    : "Choose a PNG, JPEG or WebP under 256 KB",
                );
                event.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  setAvatar(reader.result);
                  setError("");
                }
              };
              reader.onerror = () => setError(zh ? "读取头像失败" : "Could not read avatar");
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {zh ? "取消" : "Cancel"}
          </button>
          <button type="submit" disabled={busy || !name.trim()}>
            {zh ? "创建 Agent" : "Create Agent"}
          </button>
        </footer>
      </form>
    </Modal>,
    document.body,
  );
};
