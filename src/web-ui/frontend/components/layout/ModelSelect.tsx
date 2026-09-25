import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useModels } from "../../hooks/useModels";
import { command } from "../../lib/api";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./ModelSelect.css";

export const ModelSelect = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const models = useModels();
  const action = useAsyncAction();
  const selected = JSON.stringify([snapshot.model.provider, snapshot.model.id]);

  return (
    <div className="model-select">
      <select
        aria-label={t("model")}
        value={selected}
        disabled={
          !connected ||
          action.pending ||
          snapshot.operation !== "idle" ||
          snapshot.state.hasPendingSave
        }
        onChange={(event) => {
          const [provider, id] = JSON.parse(event.target.value) as [string, string];

          void action.run(() =>
            command("/sessions/" + snapshot.sessionId + "/model", { provider, id }, "PUT"),
          );
        }}
      >
        {!models.data?.some(
          (model) => model.provider === snapshot.model.provider && model.id === snapshot.model.id,
        ) && <option value={selected}>{snapshot.model.name}</option>}
        {models.data?.map((model) => (
          <option
            key={model.provider + ":" + model.id}
            value={JSON.stringify([model.provider, model.id])}
          >
            {model.provider} / {model.name}
          </option>
        ))}
      </select>
      <ErrorNotice error={models.error ?? action.error} />
    </div>
  );
};
