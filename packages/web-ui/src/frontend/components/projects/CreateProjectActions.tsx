import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./CreateProjectActions.css";

export const CreateProjectActions = ({
  saving,
  canCreate,
  onCancel,
}: {
  saving: boolean;
  canCreate: boolean;
  onCancel(): void;
}) => {
  const { t } = useTranslation();

  return (
    <footer className="create-project-actions">
      <ActionButton className="ghost" disabled={saving} onClick={onCancel}>
        {t("cancel")}
      </ActionButton>
      <ActionButton type="submit" className="create-project-submit" disabled={!canCreate}>
        {t(saving ? "saving" : "createProject")}
      </ActionButton>
    </footer>
  );
};
