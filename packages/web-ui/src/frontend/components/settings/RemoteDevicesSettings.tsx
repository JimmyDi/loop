import { useTranslation } from "react-i18next";

import { useRemoteDevices } from "../../hooks/useRemoteDevices";
import { ActionButton } from "../ui/ActionButton";
import "./RemoteDevicesSettings.css";

export const RemoteDevicesSettings = () => {
  const { t } = useTranslation();
  const devices = useRemoteDevices();
  return (
    <section className="remote-devices-settings" aria-label={t("pairing.devices")}>
      <h4>{t("pairing.devices")}</h4>
      <ActionButton
        disabled={!devices.query.data?.connected || devices.pending}
        onClick={() => void devices.createInvite()}
      >
        {t("pairing.pairDevice")}
      </ActionButton>
      {devices.invite && devices.qr && (
        <div className="remote-devices-invite">
          <img src={devices.qr} alt={t("pairing.qrAlt")} width={208} height={208} />
          <p>{t("pairing.scan")}</p>
          <a href={devices.invite.url} target="_blank" rel="noopener noreferrer">
            {t("pairing.openLink")}
          </a>
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
    </section>
  );
};
