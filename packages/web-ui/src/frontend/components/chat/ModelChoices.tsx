import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModelChoice } from "../../../shared/protocol";
import "./ModelChoices.css";

export const ModelChoices = ({
  models,
  current,
  disabled,
  select,
}: {
  models: ModelChoice[];
  current: ModelChoice;
  disabled: boolean;
  select(model: ModelChoice): void;
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const matches = models.filter((model) =>
    [model.name, model.id, model.provider, model.providerName]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const providers = new Map(
    matches.map((model) => [model.provider, model.providerName || model.provider]),
  );
  return (
    <>
      <input
        ref={input}
        className="model-search"
        aria-label={t("searchModels")}
        placeholder={t("searchModels")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="model-choice-list" role="menu" aria-label={t("model")}>
        {[...providers].map(([provider, name]) => (
          <div role="group" aria-label={name} key={provider}>
            <p className="model-provider-label">{name}</p>
            {matches
              .filter((model) => model.provider === provider)
              .map((model) => {
                const selected = current.provider === model.provider && current.id === model.id;
                return (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    tabIndex={-1}
                    key={model.id}
                    disabled={disabled}
                    onClick={() => select(model)}
                    title={model.provider + " / " + model.id}
                  >
                    <span>
                      {model.name}
                      <small>{model.id !== model.name ? model.id : undefined}</small>
                    </span>
                    {selected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
          </div>
        ))}
        {!matches.length && (
          <p className="model-empty" role="status">
            {t(models.length ? "noMatchingModels" : "noConfiguredModels")}
          </p>
        )}
      </div>
    </>
  );
};
