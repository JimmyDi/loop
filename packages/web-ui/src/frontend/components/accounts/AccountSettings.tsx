import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { command } from "../../lib/api";
import { useAccount } from "../../state/account-store";
import { Modal } from "../ui/Modal";
import "./AccountSettings.css";

export const AccountSettings = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const user = useAccount((state) => state.user);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailed(false);
    try {
      await command("/auth/password", {
        currentPassword: form.get("currentPassword"),
        password: form.get("password"),
      });
      location.reload();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("accounts.settings")}
      onClose={onClose}
      closeLabel={t("close")}
      closeDisabled={busy}
    >
      <div className="account-settings">
        <p>{user?.username}</p>
        <label>
          {t("accounts.userId")}
          <input readOnly value={user?.id ?? ""} />
        </label>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            {t("accounts.currentPassword")}
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <label>
            {t("accounts.newPassword")}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={1024}
            />
          </label>
          {failed && <p role="alert">{t("accounts.failed")}</p>}
          <button type="submit" disabled={busy}>
            {t("accounts.changePassword")}
          </button>
        </form>
      </div>
    </Modal>
  );
};
