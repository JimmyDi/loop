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
            <h4>{t("pairing.devices")}</h4>
          </div>
        </div>
        <div className="remote-devices-settings">
          {devices.generating && <p role="status">{t("pairing.generating")}</p>}
          {devices.invite && devices.qr && (
            <div className="remote-devices-invite">
              <img src={devices.qr} alt={t("pairing.qrAlt")} width={208} height={208} />
              <p>{t("pairing.scan")}</p>
              <a href={devices.invite.url} target="_blank" rel="noopener noreferrer">
                {t("pairing.openLink")}
              </a>
            </div>
          )}
          {!devices.invite && !devices.generating && !devices.query.data?.pending.length && (
            <ActionButton
              disabled={!connected || !devices.query.data?.connected || devices.pending}
              onClick={devices.createInvite}
            >
              {t("pairing.refreshCode")}
            </ActionButton>
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
