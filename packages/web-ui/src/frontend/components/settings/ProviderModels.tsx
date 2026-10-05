import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProviderCatalogEntry, ProviderConfig, ProviderModel } from "../../../shared/provider";
import { command } from "../../lib/api";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ProviderModelRow } from "./ProviderModelRow";
import "./ProviderModels.css";

export const ProviderModels = ({
  value,
  onChange,
  config,
  existing,
  catalog,
  onPendingChange,
}: {
  value: ProviderModel[];
  onChange(value: ProviderModel[]): void;
  config: ProviderConfig;
  existing: boolean;
  catalog?: ProviderCatalogEntry;
  onPendingChange?(pending: boolean): void;
}) => {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const [emptyResult, setEmptyResult] = useState(false);
  const update = (index: number, patch: Partial<ProviderModel>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const fetchModels = () =>
    action.run(async () => {
      onPendingChange?.(true);
      setEmptyResult(false);
      try {
        const models = await command<ProviderModel[]>("/settings/providers/discover", {
          ...config,
          savedId: existing ? config.id : undefined,
        });
        setEmptyResult(models.length === 0);
        if (!models.length) return;
        const merged = new Map(
          value.filter((item) => item.id.trim()).map((item) => [item.id.trim(), item]),
        );
        for (const model of models) {
          if (!merged.has(model.id)) merged.set(model.id, model);
        }
        onChange([...merged.values()]);
      } finally {
        onPendingChange?.(false);
      }
    });

  return (
    <div className="provider-models" aria-busy={action.pending}>
      <div className="provider-models-heading">
        <h4>{t("modelCatalog")}</h4>
        <ActionButton
          disabled={action.pending}
          title={catalog ? t("providerCatalogHint", { name: catalog.name }) : undefined}
          onClick={() => void fetchModels()}
        >
          {t(action.pending ? "loading" : "fetchModels")}
        </ActionButton>
      </div>
      {catalog && (
        <p className="provider-models-hint">{t("providerCatalogHint", { name: catalog.name })}</p>
      )}
      <ErrorNotice error={action.error} />
      {emptyResult && <p role="status">{t("noDiscoveredModels")}</p>}
      {!value.length && !emptyResult && <p>{t("noProviderModels")}</p>}
      <div className="provider-models-list">
        <fieldset className="provider-models-rows" disabled={action.pending}>
          {value.map((model, index) => (
            <ProviderModelRow
              key={index}
              model={model}
              index={index}
              onChange={(patch) => update(index, patch)}
              onRemove={() => onChange(value.filter((_, i) => i !== index))}
            />
          ))}
        </fieldset>
      </div>
      <ActionButton disabled={action.pending} onClick={() => onChange([...value, { id: "" }])}>
        ＋ {t("addModel")}
      </ActionButton>
    </div>
  );
};
