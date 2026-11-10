import { useEffect, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { AccountSession } from "../../../shared/accounts";
import { api, command } from "../../lib/api";
import { activateAccountPreferences } from "../../lib/account-preferences";
import { useAccount } from "../../state/account-store";
import { isRemoteClient } from "../../lib/remote-session";
import { LoopIcon } from "../ui/LoopIcon";
import "./AccountGate.css";

export const AccountGate = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["account-session"],
    queryFn: () => api<AccountSession>("/auth/session"),
    refetchInterval: 15_000,
    retry: false,
  });
  const [active, setActive] = useState<string>();
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const user = session.isError ? null : session.data?.user;
  useEffect(() => {
    const check = () => void client.invalidateQueries({ queryKey: ["account-session"] });
    window.addEventListener("loop-account-check", check);
    return () => window.removeEventListener("loop-account-check", check);
  }, [client]);
  useEffect(() => {
    if (session.isPending) return;
    const id = user?.id;
    if (id !== active) {
      void client.cancelQueries({ predicate: (row) => row.queryKey[0] !== "account-session" });
      client.removeQueries({
        predicate: (row) =>
          !["account-session", "remote-session"].includes(String(row.queryKey[0])),
      });
      activateAccountPreferences(id);
      setActive(id);
    }
    useAccount.setState({ user: user ?? null });
  }, [active, user, client, session.isPending]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(false);
    try {
      await command(register ? "/auth/register" : "/auth/login", {
        username: form.get("username"),
        password: form.get("password"),
      });
      await session.refetch();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  if (user && active === user.id) return children;
  if (session.isPending || user)
    return (
      <main className="account-gate" role="status">
        {t("loading")}
      </main>
    );
  if (session.isError || isRemoteClient())
    return (
      <main className="account-gate">
        <p role="alert">{t("accounts.unavailable")}</p>
        <button type="button" onClick={() => void session.refetch()}>
          {t("retry")}
        </button>
      </main>
    );
  return (
    <main className="account-gate">
      <header className="account-brand">
        <LoopIcon size={28} />
        <span>Loop</span>
      </header>
      <section className="account-panel" aria-labelledby="account-title">
        <div className="account-mark">
          <LoopIcon size={40} />
        </div>
        <h1 id="account-title">{t(register ? "accounts.createTitle" : "accounts.welcome")}</h1>
        <p className="account-description">
          {t(register ? "accounts.createDescription" : "accounts.loginDescription")}
        </p>
        <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <label htmlFor="account-username">{t("accounts.username")}</label>
          <input
            id="account-username"
            name="username"
            autoComplete="username"
            placeholder={t("accounts.usernamePlaceholder")}
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            aria-describedby={register ? "account-username-hint" : undefined}
          />
          {register && (
            <p id="account-username-hint" className="account-hint">
              {t("accounts.usernameHint")}
            </p>
          )}
          <label htmlFor="account-password">{t("accounts.passwordLabel")}</label>
          <div className="account-password">
            <input
              id="account-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("accounts.passwordPlaceholder")}
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={1024}
              aria-describedby={error ? "account-error" : undefined}
            />
            <button
              type="button"
              className="account-reveal"
              aria-label={t(showPassword ? "accounts.hidePassword" : "accounts.showPassword")}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </div>
          {error && (
            <p id="account-error" className="account-error" role="alert">
              {t("accounts.failed")}
            </p>
          )}
          <button className="account-submit" type="submit" disabled={busy}>
            <span>
              {t(busy ? "accounts.submitting" : register ? "accounts.create" : "accounts.login")}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="account-switch">
          <span>{t(register ? "accounts.hasAccount" : "accounts.noAccount")}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setError(false);
              setShowPassword(false);
            }}
          >
            {t(register ? "accounts.login" : "accounts.create")}
          </button>
        </p>
      </section>
      <footer className="account-footer">
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
          <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" />
        </svg>
        {t("accounts.localAccount")}
      </footer>
    </main>
  );
};
