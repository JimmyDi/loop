import { Button } from "@openuidev/react-ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { countdownProps } from "../../../shared/openui-scenarios";
import "./Countdown.css";

const Countdown = ({ title, seconds }: z.infer<typeof countdownProps>) => {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(seconds * 1000);
  const [deadline, setDeadline] = useState<number>();

  useEffect(() => {
    if (deadline === undefined) return;
    let timeout: number;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) {
        setDeadline(undefined);
        return;
      }
      timeout = window.setTimeout(tick, left % 1000 || 1000);
    };
    tick();
    return () => window.clearTimeout(timeout);
  }, [deadline]);

  const total = Math.ceil(remaining / 1000);
  const display = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <p className="loop-openui-countdown" role="timer">
        {display}
      </p>
      {total === 0 && <p role="status">{t("openUi.timerDone")}</p>}
      <div className="loop-openui-controls">
        <Button
          type="button"
          size="small"
          variant="primary"
          disabled={total === 0}
          onClick={() => {
            if (deadline === undefined) {
              setDeadline(Date.now() + remaining);
            } else {
              setRemaining(Math.max(0, deadline - Date.now()));
              setDeadline(undefined);
            }
          }}
        >
          {t(deadline === undefined ? "openUi.start" : "openUi.pause")}
        </Button>
        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() => {
            setDeadline(undefined);
            setRemaining(seconds * 1000);
          }}
        >
          {t("openUi.reset")}
        </Button>
      </div>
    </section>
  );
};

export default Countdown;
