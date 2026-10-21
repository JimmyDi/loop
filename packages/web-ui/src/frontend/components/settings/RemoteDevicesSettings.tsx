import { useTranslation } from "react-i18next";

import { useRemoteDevices } from "../../hooks/useRemoteDevices";
import { ActionButton } from "../ui/ActionButton";
import { RemoteAccessMarker } from "./RemoteAccessMarker";
import "./RemoteDevicesSettings.css";

export const RemoteDevicesSettings = ({ connected = true }: { connected?: boolean }) => {
  const { t } = useTranslation();
  const devices = useRemoteDevices(connected);
  const complete = !!devices.query.data?.devices.length;
  return (
    <li
      className="remote-devices-step"
      data-complete={complete && !devices.generating && !devices.error}
    >
      <RemoteAccessMarker
        complete={complete}
        loading={devices.generating}
        failed={!!devices.error}
      />
      <section className="remote-access-step-content" aria-label={t("pairing.devices")}>
        <div className="remote-access-step-heading">
          <span className="remote-access-step-number">{t("remote.step", { number: 4 })}</span>
          <div className="remote-access-step-title">
            <div className="remote-access-actions">
              <span className="remote-access-action" title={t("pairing.refreshCode")}>
                <ActionButton
                  className="icon ghost"
                  aria-label={t("pairing.refreshCode")}
                  title={t("pairing.refreshCode")}
                  disabled={
                    !connected ||
                    !devices.query.data?.connected ||
                    devices.query.isError ||
                    devices.pending ||
                    !!devices.query.data?.pending.length
                  }
                  onClick={devices.createInvite}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17" />
                  </svg>
                </ActionButton>
              </span>
            </div>
            <h4>{t("pairing.devices")}</h4>
            {devices.invite && devices.qr && (
              <p className="remote-devices-scan">{t("pairing.scan")}</p>
            )}
          </div>
        </div>
        <div className="remote-devices-settings">
          {devices.generating && <p role="status">{t("pairing.generating")}</p>}
          {devices.invite && devices.qr && (
            <div className="remote-devices-invite">
              <img src={devices.qr} alt={t("pairing.qrAlt")} width={208} height={208} />
            </div>
          )}
          {devices.query.data?.pending.map((item) => (
            <div className="remote-devices-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{t("pairing.confirmCode", { code: item.confirmation })}</p>
                <p>{t("pairing.approvalWarning")}</p>
              </div>
              <ActionButton
                disabled={devices.pending}
                onClick={() => void devices.decide(item.id, false)}
              >
                {t("pairing.reject")}
              </ActionButton>
              <ActionButton
                disabled={devices.pending}
                onClick={() => void devices.decide(item.id, true)}
              >
                {t("pairing.approve")}
              </ActionButton>
            </div>
          ))}
          {devices.query.data?.devices.map((item) => (
            <div className="remote-devices-row" key={item.id}>
              <strong>{item.name}</strong>
              <ActionButton disabled={devices.pending} onClick={() => void devices.revoke(item.id)}>
                {t("pairing.revoke")}
              </ActionButton>
            </div>
          ))}
          {devices.error && <p role="alert">{t("pairing.manageFailed")}</p>}
        </div>
      </section>
    </li>
  );
};
