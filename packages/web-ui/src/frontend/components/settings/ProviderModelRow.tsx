import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProviderModel } from "../../../shared/provider";
import { ActionButton } from "../ui/ActionButton";
import { SettingsField } from "../ui/SettingsField";
import "./ProviderModelRow.css";

export const ProviderModelRow = ({
  model,
  index,
  onChange,
  onRemove,
}: {
  model: ProviderModel;
  index: number;
  onChange(patch: Partial<ProviderModel>): void;
  onRemove(): void;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const identity = model.id || index + 1;
  return (
    <div className="provider-model">
      <div className="provider-model-heading">
        <SettingsField
          label={t("modelId")}
          required
          maxLength={200}
          placeholder={t("modelId")}
          value={model.id}
          onChange={(event) => onChange({ id: event.target.value })}
        />
        <SettingsField
          label={t("displayName")}
          maxLength={200}
          placeholder={t("displayName")}
          value={model.name ?? ""}
          onChange={(event) => onChange({ name: event.target.value || undefined })}
        />
        <ActionButton
          className="provider-model-icon ghost"
          aria-label={t("modelOptionsFor", { id: identity })}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="provider-model-chevron">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </ActionButton>
        <ActionButton
          className="provider-model-icon provider-model-remove ghost"
          aria-label={t("removeModel", { id: identity })}
          onClick={onRemove}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
          </svg>
        </ActionButton>
      </div>
      <div className="provider-model-capacity" id={detailsId} hidden={!expanded}>
        <SettingsField
          label={t("contextWindow")}
          type="number"
          min={1}
          max={100000000}
          placeholder="128000"
          value={model.contextWindow ?? ""}
          onChange={(event) =>
            onChange({ contextWindow: event.target.value ? Number(event.target.value) : undefined })
          }
        />
        <SettingsField
          label={t("maxOutputTokens")}
          type="number"
          min={1}
          max={model.contextWindow ?? 128000}
          placeholder={String(Math.min(4096, model.contextWindow ?? 128000))}
          value={model.maxTokens ?? ""}
          onChange={(event) =>
            onChange({ maxTokens: event.target.value ? Number(event.target.value) : undefined })
          }
        />
      </div>
    </div>
  );
};
