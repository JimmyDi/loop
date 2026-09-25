import { useTranslation } from "react-i18next";

import type { ProviderInput, ProviderView } from "../../../shared/provider";
import { useProviderForm } from "../../hooks/useProviderForm";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SettingsField } from "../ui/SettingsField";
import "./ProviderForm.css";

export const ProviderForm = ({
  initial,
  save,
  onClose,
}: {
  initial: ProviderView | null;
  save(input: ProviderInput): Promise<void>;
  onClose(): void;
}) => {
  const { t } = useTranslation();
  const form = useProviderForm(initial, save);

  return (
    <form
      className="provider-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <p>{t("providerProtocol")}</p>
      <fieldset disabled={form.pending}>
        <SettingsField
          label={t("providerName")}
          required
          maxLength={100}
          value={form.values.name}
          onChange={(e) => form.set("name", e.target.value)}
        />
        <SettingsField
          label={t("baseUrl")}
          hint={t("baseUrlHint")}
          type="url"
          required
          placeholder="http://localhost:8080/v1"
          value={form.values.baseUrl}
          onChange={(e) => form.set("baseUrl", e.target.value)}
        />
        <SettingsField
          label={t("modelId")}
          required
          maxLength={200}
          value={form.values.modelId}
          onChange={(e) => form.set("modelId", e.target.value)}
        />
        <label className="provider-authentication">
          {t("authentication")}
          <select
            value={form.values.authentication}
            onChange={(e) =>
              form.set("authentication", e.target.value as ProviderInput["authentication"])
            }
          >
            <option value="apiKey">{t("apiKey")}</option>
            <option value="none">{t("noAuthentication")}</option>
          </select>
        </label>
        {form.values.authentication === "apiKey" && (
          <SettingsField
            label={t("apiKey")}
            type="password"
            autoComplete="off"
            hint={t(initial?.hasApiKey ? "savedKeyHint" : "newKeyHint")}
            value={form.values.apiKey}
            onChange={(e) => form.set("apiKey", e.target.value)}
          />
        )}
      </fieldset>
      <p>{t("providerStorage")}</p>
      <ErrorNotice error={form.error} />
      {form.saved && <p role="status">{t("providerSaved")}</p>}
      <div className="provider-form-actions">
        <ActionButton type="submit" className="primary" disabled={form.pending}>
          {t(form.pending ? "saving" : "save")}
        </ActionButton>
        <ActionButton onClick={onClose} disabled={form.pending}>
          {t("close")}
        </ActionButton>
      </div>
    </form>
  );
};
