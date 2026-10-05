import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  ProviderCatalogEntry,
  ProviderConfig,
  ProviderRecord,
} from "../../../shared/provider";
import { useProviderForm } from "../../hooks/useProviderForm";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SettingsField } from "../ui/SettingsField";
import { ProviderModels } from "./ProviderModels";
import "./ProviderForm.css";

export const ProviderForm = ({
  initial,
  existing,
  catalog,
  usedIds,
  save,
  onClose,
}: {
  initial: ProviderRecord;
  existing: boolean;
  catalog: ProviderCatalogEntry[];
  usedIds: string[];
  save(input: ProviderConfig): Promise<void>;
  onClose(): void;
}) => {
  const { t } = useTranslation();
  const form = useProviderForm(initial, save);
  const [discovering, setDiscovering] = useState(false);
  const custom = form.values.kind === "custom";
  return (
    <form
      className={"provider-form" + (custom ? " provider-form-custom" : "")}
      onSubmit={(event) => {
        event.preventDefault();
        if (!discovering) void form.submit();
      }}
    >
      <fieldset disabled={form.pending || discovering}>
        <div className="provider-connection-fields">
          {!custom && (
            <label className="provider-authentication">
              {t("provider")}
              <select
                required
                disabled={existing}
                value={form.values.id}
                onChange={(event) => {
                  const selected = catalog.find((item) => item.id === event.target.value);
                  if (!selected) return;
                  form.set("id", selected.id);
                  form.set("name", selected.name);
                  form.set("baseUrl", selected.baseUrl);
                  form.set("api", selected.api);
                  form.set("models", selected.models);
                  form.set("apiKey", "");
                }}
              >
                <option value="">{t("selectProvider")}</option>
                {catalog
                  .filter((item) => item.id === initial.id || !usedIds.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.id})
                    </option>
                  ))}
              </select>
              <small>{t("builtinProviderHint")}</small>
            </label>
          )}
          {custom && (
            <>
              <SettingsField
                label={t("providerId")}
                required
                maxLength={80}
                pattern="[a-z][a-z0-9-]*"
                readOnly={existing}
                hint={t("providerIdHint")}
                title={t("providerIdHint")}
                value={form.values.id}
                onChange={(event) => form.set("id", event.target.value)}
              />
              <SettingsField
                label={t("providerName")}
                required
                maxLength={100}
                value={form.values.name}
                onChange={(event) => form.set("name", event.target.value)}
              />
              <SettingsField
                label={t("baseUrl")}
                hint={t("baseUrlHint")}
                title={t("baseUrlHint")}
                type="url"
                required
                placeholder="https://gateway.example.com/v1"
                value={form.values.baseUrl}
                onChange={(event) => form.set("baseUrl", event.target.value)}
              />
              <label className="provider-authentication">
                {t("apiProtocol")}
                <select
                  value={form.values.api}
                  onChange={(event) => form.set("api", event.target.value)}
                >
                  <option value="openai-completions">OpenAI Chat Completions</option>
                  <option value="openai-responses">OpenAI Responses</option>
                  <option value="anthropic-messages">Anthropic Messages</option>
                </select>
              </label>
              <label className="provider-authentication">
                {t("authentication")}
                <select
                  value={form.values.authentication}
                  onChange={(event) =>
                    form.set(
                      "authentication",
                      event.target.value as ProviderConfig["authentication"],
                    )
                  }
                >
                  <option value="apiKey">{t("apiKey")}</option>
                  <option value="none">{t("noAuthentication")}</option>
                </select>
              </label>
            </>
          )}
          {form.values.authentication === "apiKey" && (
            <SettingsField
              label={t("apiKey")}
              type="password"
              required={
                !initial.hasApiKey ||
                form.values.baseUrl !== initial.baseUrl ||
                form.values.api !== initial.api
              }
              autoComplete="off"
              hint={t(initial.hasApiKey ? "savedKeyHint" : "newKeyHint")}
              title={t(initial.hasApiKey ? "savedKeyHint" : "newKeyHint")}
              value={form.values.apiKey}
              onChange={(event) => form.set("apiKey", event.target.value)}
            />
          )}
        </div>
        {custom && (
          <ProviderModels
            key={
              form.values.id + form.values.baseUrl + form.values.api + form.values.authentication
            }
            value={form.values.models}
            onChange={(models) => form.set("models", models)}
            config={form.values}
            existing={existing}
            catalog={catalog.find((provider) => provider.id === form.values.id)}
            onPendingChange={setDiscovering}
          />
        )}
      </fieldset>
      <p>{t("providerStorage")}</p>
      <ErrorNotice error={form.error} />
      <div className="provider-form-actions">
        <ActionButton type="submit" className="primary" disabled={form.pending || discovering}>
          {t(form.pending ? "saving" : "save")}
        </ActionButton>
        <ActionButton onClick={onClose} disabled={form.pending}>
          {t("cancel")}
        </ActionButton>
      </div>
    </form>
  );
};
