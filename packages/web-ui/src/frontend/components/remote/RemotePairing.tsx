import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { PairingStatus } from "../../../shared/remote-devices";
import { api, command } from "../../lib/api";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { clearPairingInvitation } from "../../remote/pairing-invitation";
import "./RemotePairing.css";

export const RemotePairing = ({ token, onApproved }: { token: string; onApproved(): void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmation, setConfirmation] = useState<string>();
  const action = useAsyncAction();
  const query = useQuery({
    queryKey: ["remote-pairing", token],
    gcTime: 0,
    queryFn: ({ signal }) => api<PairingStatus>("/remote-pairing", { signal }),
    enabled: submitted || !token,
    retry: false,
    refetchInterval: (query) => (query.state.data?.state === "pending" ? 1500 : false),
  });
  useEffect(() => {
    if (query.data?.state === "approved") onApproved();
  }, [query.data?.state, onApproved]);
  const state = submitted || !token ? query.data?.state : undefined;
  const waiting = state === "pending" || (submitted && !state);
  const status =
    state === "rejected" || state === "expired" || state === "unpaired"
      ? state
      : !token && !state && !query.error
        ? "checking"
        : undefined;
  return (
    <main className="remote-pairing">
      <div className="remote-pairing-card">
        <h1>{t("pairing.title")}</h1>
        <p>{t("pairing.guidance")}</p>
        {waiting ? (
          <div role="status">
            <p>{t("pairing.waiting")}</p>
            <strong className="remote-pairing-code">
              {query.data?.confirmation ?? confirmation}
            </strong>
            <p>{t("pairing.compare")}</p>
          </div>
        ) : status ? (
          <p role="status">{t("pairing." + status)}</p>
        ) : (
          token &&
          state !== "approved" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  const result = await command<PairingStatus>("/remote-pairing", {
                    token,
                    name: name.trim(),
                  });
                  setConfirmation(result.confirmation);
                  clearPairingInvitation();
                  setSubmitted(true);
                  await query.refetch();
                });
              }}
            >
              <label>
                {t("pairing.deviceName")}
                <input
                  value={name}
                  maxLength={80}
                  required
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <ActionButton type="submit" disabled={action.pending || !name.trim()}>
                {t("pairing.request")}
              </ActionButton>
            </form>
          )
        )}
        {(action.error || query.error) && <p role="alert">{t("pairing.requestFailed")}</p>}
      </div>
    </main>
  );
};
