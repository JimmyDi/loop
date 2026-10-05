import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useGeneralSettings } from "../../hooks/useGeneralSettings";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { DefaultPermissionSelect } from "./DefaultPermissionSelect";
import "./PermissionSettings.css";

export const PermissionSettings = () => {
  const { t } = useTranslation();
  const id = useId();
  const { query, pending, error, save } = useGeneralSettings();
  return (
    <div className="permission-settings">
      <div className="general-settings-row">
        <div className="general-settings-description">
          <span id={id}>{t("permissions.defaultLabel")}</span>
          <small id={id + "-description"}>{t("permissions.defaultDescription")}</small>
        </div>
        <DefaultPermissionSelect
          value={query.data?.permissionPreset}
          disabled={!query.isSuccess}
          pending={pending}
          error={error}
          select={save}
          labelId={id}
          descriptionId={id + "-description"}
        />
      </div>
      <ErrorNotice error={error ?? query.error} />
      {query.isError && (
        <ActionButton disabled={query.isFetching || pending} onClick={() => void query.refetch()}>
          {t("retry")}
        </ActionButton>
      )}
    </div>
  );
};
