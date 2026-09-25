import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import { ActionButton } from "./ActionButton";
import "./CopyButton.css";

export const CopyButton = ({ text }: { text: string }) => {
  const { t } = useTranslation();
  const { status, copy } = useCopy();

  return (
    <ActionButton className="copy-button ghost" onClick={() => void copy(text)} aria-live="polite">
      {t(status)}
    </ActionButton>
  );
};
