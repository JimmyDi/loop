import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./ComposerDeliveryNotice.css";

export const ComposerDeliveryNotice = ({
  disabled,
  retry,
}: {
  disabled: boolean;
  retry(): void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="composer-uncertain">
      {t("uncertain")}
      <ActionButton disabled={disabled} onClick={retry}>
        {t("syncRetry")}
      </ActionButton>
    </div>
  );
};
