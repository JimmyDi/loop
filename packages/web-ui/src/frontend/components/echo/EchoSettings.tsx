import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { EchoConnection } from "../../../shared/echo";
import { command } from "../../lib/api";
import { Modal } from "../ui/Modal";
import "./EchoDialog.css";
import "./EchoSettings.css";

export const EchoSettings = ({
  connection,
  onSaved,
  onClose,
}: {
  connection?: EchoConnection;
  onSaved(): void;
  onClose(): void;
}) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [endpoint, setEndpoint] = useState(connection?.endpoint ?? "http://localhost:8080");
  const [token, setToken] = useState("");
  const [desktop, setDesktop] = useState(connection?.desktop ?? true);
  const [idleSeconds, setIdleSeconds] = useState(connection?.idleSeconds ?? 900);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return createPortal(
    <Modal
      title={zh ? "沙盒连接" : "Sandbox connection"}
      className="echo-form-dialog"
      closeLabel={zh ? "关闭" : "Close"}
      closeDisabled={busy}
      onClose={onClose}
    >
      <form
        className="echo-settings"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          void command(
            "/echo/connection",
            {
              provider: "loop-sandbox",
              endpoint,
              ...(token ? { token } : {}),
              desktop,
              idleSeconds,
            },
            "PUT",
          )
            .then(() => {
              setToken("");
              onSaved();
            })
            .catch((error) => setError(String(error)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          {zh ? "服务地址" : "Service URL"}
          <input
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            required
          />
        </label>
        <label>
          {zh ? "令牌" : "Token"}
          <input
            type="password"
            autoComplete="new-password"
            value={token}
            placeholder={connection?.tokenSaved ? (zh ? "已保存" : "Saved") : ""}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={desktop}
            onChange={(event) => setDesktop(event.target.checked)}
          />
          {zh ? "桌面电脑" : "Desktop computer"}
        </label>
        <label>
          {zh ? "空闲停止（秒）" : "Idle stop (seconds)"}
          <input
            type="number"
            min={60}
            max={86400}
            value={idleSeconds}
            onChange={(event) => setIdleSeconds(Number(event.target.value))}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {zh ? "取消" : "Cancel"}
          </button>
          <button type="submit" disabled={busy}>
            {zh ? "保存连接" : "Save connection"}
          </button>
        </footer>
      </form>
    </Modal>,
    document.body,
  );
};
