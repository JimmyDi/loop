import { useTranslation } from "react-i18next";

import "./RemoteAccessIssue.css";

export const RemoteAccessIssue = ({
  message,
  warning = false,
}: {
  message: string;
  warning?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <p className="remote-access-issue" role="alert" data-tone={warning ? "warning" : "error"}>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m10 2 8 15H2L10 2Z" />
        <path d="M10 7v4m0 3h.01" />
      </svg>
      <span>{t(message)}</span>
    </p>
  );
};
