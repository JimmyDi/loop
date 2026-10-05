import { useTranslation } from "react-i18next";

import type { ApprovalRequest } from "../../../shared/protocol";
import "./ApprovalDetails.css";

export const ApprovalDetails = ({
  operation,
}: {
  operation: NonNullable<ApprovalRequest["operation"]>;
}) => {
  const { t } = useTranslation();
  return (
    <details className="approval-details">
      <summary>{t("permissions.details")}</summary>
      <p>
        {t("permissions.workspace")}: <code>{operation.workspaceRoot}</code>
      </p>
      {operation.kind === "file-write" && (
        <p>
          {t("permissions.target")}: <code>{operation.targetPath}</code>
        </p>
      )}
      <p>
        {t(operation.kind === "file-write" ? "permissions.fileScope" : "permissions.shellScope")}
      </p>
      <pre tabIndex={0}>
        <code>{JSON.stringify(operation.arguments, null, 2)}</code>
      </pre>
    </details>
  );
};
