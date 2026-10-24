import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { getPwaState, installPwa, subscribePwa, updatePwa } from "../../pwa/pwa-client";
import { ActionButton } from "../ui/ActionButton";
import "./PwaStatus.css";

export const PwaStatus = () => {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribePwa, getPwaState, getPwaState);
  const [dismissed, setDismissed] = useState(false);
  const [help, setHelp] = useState(false);
  const [deferred, setDeferred] = useState<ServiceWorker>();
  const update = state.waiting && state.waiting !== deferred;
  const install = !state.installed && !dismissed;
  if (!state.enabled || (!state.offline && !update && !install)) return null;
  return (
    <aside className="pwa-status" aria-label={t("pwa.title")}>
      {state.offline ? (
        <p role="status">{t("pwa.offline")}</p>
      ) : update ? (
        <>
          <p role="status">{t("pwa.updateReady")}</p>
          <ActionButton onClick={updatePwa}>{t("pwa.update")}</ActionButton>
          <ActionButton className="ghost" onClick={() => setDeferred(state.waiting)}>
            {t("pwa.later")}
          </ActionButton>
        </>
      ) : (
        <>
          <p>{t("pwa.installHint")}</p>
          <ActionButton
            onClick={() => {
              if (state.install) void installPwa().catch(() => setHelp(true));
              else setHelp((open) => !open);
            }}
            aria-expanded={state.install ? undefined : help}
          >
            {t(state.install ? "pwa.install" : "pwa.instructions")}
          </ActionButton>
          <ActionButton className="ghost" onClick={() => setDismissed(true)}>
            {t("pwa.dismiss")}
          </ActionButton>
          {help && <p className="pwa-instructions">{t("pwa.help")}</p>}
        </>
      )}
    </aside>
  );
};
