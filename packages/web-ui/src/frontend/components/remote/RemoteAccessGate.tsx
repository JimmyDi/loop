import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { RemoteSession } from "../../../shared/remote-devices";
import { api } from "../../lib/api";
import { isRemoteClient, setRemoteCsrf, takeBootstrapSession } from "../../lib/remote-session";
import { useSessions } from "../../state/session-store";
import { RemotePairing } from "./RemotePairing";
import "./RemoteAccessGate.css";

export const RemoteAccessGate = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const remote = isRemoteClient();
  const [bootstrap] = useState(() => (remote ? takeBootstrapSession() : undefined));
  const client = useQueryClient();
  const [token, setToken] = useState(() => {
    if (!remote) return "";
    const value = new URLSearchParams(window.location.hash.slice(1)).get("pair") ?? "";
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    return value;
  });
  const query = useQuery({
    queryKey: ["remote-session"],
    enabled: remote,
    queryFn: ({ signal }) => api<RemoteSession>("/remote-session", { signal }),
    retry: false,
    refetchInterval: 15_000,
    initialData: bootstrap?.session,
    initialDataUpdatedAt: bootstrap?.checkedAt,
    staleTime: bootstrap ? 15_000 : 0,
  });
  const refresh = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);
  const session = query.data;
  const authorized = !query.isError && session?.mode === "remote" && session.authorized;
  if (authorized) setRemoteCsrf(session.csrf);
  else if (remote) setRemoteCsrf();
  useEffect(() => {
    if (!remote) return;
    const check = () => void client.invalidateQueries({ queryKey: ["remote-session"] });
    window.addEventListener("loop-remote-check", check);
    return () => window.removeEventListener("loop-remote-check", check);
  }, [client, remote]);
  useEffect(() => {
    if (authorized) setToken("");
    if (!remote || authorized || query.isPending) return;
    void client.cancelQueries({
      predicate: (item) => !["remote-session", "remote-pairing"].includes(String(item.queryKey[0])),
    });
    useSessions.setState({ views: {} });
    client.removeQueries({
      predicate: (item) => !["remote-session", "remote-pairing"].includes(String(item.queryKey[0])),
    });
  }, [client, remote, authorized, query.isPending]);
  if (!remote) return children;
  if (query.isPending)
    return (
      <main className="remote-access-gate" role="status">
        {t("pairing.checking")}
      </main>
    );
  if (query.isError)
    return (
      <main className="remote-access-gate">
        <p role="alert">{t("pairing.unavailable")}</p>
        <button type="button" onClick={() => void query.refetch()}>
          {t("retry")}
        </button>
      </main>
    );
  if (!authorized) return <RemotePairing token={token} onApproved={refresh} />;
  return children;
};
