import { useTranslation } from "react-i18next";

import type { PromptTiming } from "../../../shared/protocol";
import { useElapsedTime } from "../../hooks/useElapsedTime";
import "./PromptDuration.css";

export const PromptDuration = ({ timing }: { timing: PromptTiming }) => {
  const { t } = useTranslation();
  const { startedAt, finishedAt } = timing;
  const { duration } = useElapsedTime(startedAt, finishedAt);

  return (
    <div className="prompt-duration" data-state={finishedAt === undefined ? "working" : "worked"}>
      {t(finishedAt === undefined ? "workingFor" : "workedFor", { duration })}
    </div>
  );
};
