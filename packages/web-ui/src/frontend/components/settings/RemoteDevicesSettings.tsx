import { useTranslation } from "react-i18next";

import { useRemoteDevices } from "../../hooks/useRemoteDevices";
import { ActionButton } from "../ui/ActionButton";
import { RemoteAccessMarker } from "./RemoteAccessMarker";
import "./RemoteDevicesSettings.css";

export const RemoteDevicesSettings = ({ connected = true }: { connected?: boolean }) => {
  const { t, i18n } = useTranslation();
  const devices = useRemoteDevices(connected);
  const complete = !!devices.query.data?.devices.length;
  const expired = devices.query.data?.expiredDevices ?? [];
  const failed = !!devices.error || (!complete && expired.length > 0);
  const loading = devices.generating && !complete && !expired.length;
  const expiryDate = (value: number) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  return (
    <li className="remote-devices-step" data-complete={complete && !failed}>
      <RemoteAccessMarker complete={complete} loading={loading} failed={failed} />
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
                    <path d="M20 11a8 8 0 1 1-2.3-5.7L20 8" />
                    <path d="M20 3v5h-5" />
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
          <div
            className="remote-devices-pairing"
            data-has-invite={!!(devices.invite && devices.qr)}
          >
            {devices.invite && devices.qr && (
              <div className="remote-devices-invite">
                <img src={devices.qr} alt={t("pairing.qrAlt")} width={208} height={208} />
              </div>
            )}
            {!!((devices.query.data?.devices.length ?? 0) + expired.length) && (
              <div
                className="remote-devices-list"
                role="region"
                aria-label={t("pairing.devices")}
                tabIndex={0}
              >
                {[...(devices.query.data?.devices ?? []), ...expired].map((item) => {
                  const isExpired = expired.some((device) => device.id === item.id);
                  return (
                    <div
                      className="remote-devices-row"
                      key={item.id}
                      role="group"
                      aria-label={item.name}
                    >
                      <div className="remote-device-summary">
                        <RemoteAccessMarker
                          complete={!isExpired}
                          loading={false}
                          failed={isExpired}
                        />
                        <div>
                          <strong>{item.name}</strong>
                          <p>
                            {t(isExpired ? "pairing.deviceExpired" : "pairing.devicePaired", {
                              date: expiryDate(item.expiresAt),
                            })}
                          </p>
                        </div>
                      </div>
                      <ActionButton
                        disabled={devices.pending}
                        onClick={() => void devices.revoke(item.id)}
                      >
                        {t(isExpired ? "pairing.remove" : "pairing.revoke")}
                      </ActionButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {devices.error && <p role="alert">{t("pairing.manageFailed")}</p>}
        </div>
      </section>
    </li>
  );
};
