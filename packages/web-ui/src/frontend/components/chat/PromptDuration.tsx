import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PromptTiming } from "../../../shared/protocol";
import "./PromptDuration.css";

export const PromptDuration = ({ timing }: { timing: PromptTiming }) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const { startedAt, finishedAt } = timing;

  useEffect(() => {
    if (finishedAt !== undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, finishedAt]);

  const seconds = Math.max(0, Math.floor(((finishedAt ?? now) - startedAt) / 1000));
  const duration = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="prompt-duration" data-state={finishedAt === undefined ? "working" : "worked"}>
      {t(finishedAt === undefined ? "workingFor" : "workedFor", { duration })}
    </div>
  );
};
