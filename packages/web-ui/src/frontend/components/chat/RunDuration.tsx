import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionRunTiming } from "../../../shared/protocol";
import type { ActivityStatus } from "./activity-status";

export const RunDuration = ({
  timing,
  status,
}: {
  timing?: SessionRunTiming;
  status: ActivityStatus;
}) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const ticking = status === "running" && timing !== undefined && timing.finishedAt === undefined;

  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking, timing?.startedAt]);

  if (!timing || (!ticking && timing.finishedAt === undefined))
    return <span>{t(`workStatus.${status}`)}</span>;

  const seconds = Math.max(0, Math.floor(((timing.finishedAt ?? now) - timing.startedAt) / 1000));
  const duration =
    seconds >= 3600
      ? t("workDurationHours", {
          hours: Math.floor(seconds / 3600),
          minutes: Math.floor(seconds / 60) % 60,
          seconds: seconds % 60,
        })
      : seconds >= 60
        ? t("workDurationMinutes", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
        : t("workDurationSeconds", { seconds });

  return (
    <span>
      {t(ticking ? "workingFor" : "workedFor", { duration })}
      {(status === "error" || status === "cancelled") && ` · ${t(status)}`}
    </span>
  );
};
