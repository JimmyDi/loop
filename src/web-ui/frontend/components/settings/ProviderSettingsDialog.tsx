import { useTranslation } from "react-i18next";

import { useProviderSettings } from "../../hooks/useProviderSettings";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import { ProviderForm } from "./ProviderForm";
import "./ProviderSettingsDialog.css";

export const ProviderSettingsDialog = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const { query, save } = useProviderSettings();

  return (
    <Modal title={t("providerSettings")} onClose={onClose}>
      <div className="provider-settings-dialog">
        {query.isPending && <p role="status">{t("loading")}</p>}
        <ErrorNotice error={query.error} />
        {query.isSuccess ? (
          <ProviderForm initial={query.data} save={save} onClose={onClose} />
        ) : (
          <ActionButton onClick={onClose}>{t("close")}</ActionButton>
        )}
        {query.isError && (
          <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
        )}
      </div>
    </Modal>
  );
};
