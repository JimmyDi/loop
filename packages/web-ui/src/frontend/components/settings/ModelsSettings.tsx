import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { ProviderRecord } from "../../../shared/provider";
import { useProviderSettings } from "../../hooks/useProviderSettings";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import { ProviderForm } from "./ProviderForm";
import "./ModelsSettings.css";

export const ModelsSettings = () => {
  const { t } = useTranslation();
  const { query, save, remove } = useProviderSettings();
  const [editing, setEditing] = useState<{ value: ProviderRecord; existing: boolean }>();
  const [deleting, setDeleting] = useState<ProviderRecord>();
  const [saving, setSaving] = useState(false);
  const action = useAsyncAction();
  const catalog = query.data?.catalog ?? [];
  const providers = query.data?.providers ?? [];
  const add = (kind: "builtin" | "custom") =>
    setEditing({
      existing: false,
      value: {
        id: "",
        name: "",
        kind,
        baseUrl: "",
        api: "openai-completions",
        models: [{ id: "" }],
        authentication: "apiKey",
        hasApiKey: false,
      },
    });

  return (
    <div className="models-settings">
      <h3>{t("models")}</h3>
      <p className="models-description">{t("providersDescription")}</p>
      {query.isPending && <p role="status">{t("loading")}</p>}
      <ErrorNotice error={query.error} />
      {query.isError && (
        <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
      )}
      {query.isSuccess && (
        <>
          <div className="provider-list">
            {providers.map((provider) => (
              <div className="provider-row" key={provider.id}>
                <div className="provider-row-name">
                  <span>{provider.name}</span>
                  <span
                    className="provider-status"
                    data-ready={provider.hasApiKey || provider.authentication === "none"}
                    role="img"
                    aria-label={t(
                      provider.hasApiKey || provider.authentication === "none"
                        ? "providerConfigured"
                        : "providerNeedsKey",
                    )}
                    title={t(
                      provider.hasApiKey || provider.authentication === "none"
                        ? "providerConfigured"
                        : "providerNeedsKey",
                    )}
                  />
                </div>
                <div className="provider-row-actions">
                  <ActionButton
                    onClick={() =>
                      setEditing({
                        value: provider,
                        existing: true,
                      })
                    }
                  >
                    {t("edit")}
                  </ActionButton>
                  <ActionButton
                    className="provider-delete ghost"
                    onClick={() => setDeleting(provider)}
                  >
                    {t("delete")}
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
          <div className="provider-add-actions">
            <ActionButton onClick={() => add("builtin")}>＋ {t("addProvider")}</ActionButton>
            <ActionButton onClick={() => add("custom")}>＋ {t("addCustomProvider")}</ActionButton>
          </div>
        </>
      )}
      {editing &&
        createPortal(
          <Modal
            title={t(
              editing.existing
                ? "editProvider"
                : editing.value.kind === "builtin"
                  ? "addProvider"
                  : "addCustomProvider",
            )}
            className="provider-editor-dialog"
            closeLabel={t("close")}
            closeDisabled={saving}
            onClose={() => setEditing(undefined)}
          >
            <ProviderForm
              initial={editing.value}
              existing={editing.existing}
              catalog={catalog}
              usedIds={providers.map((item) => item.id)}
              save={async (input) => {
                setSaving(true);
                try {
                  await save(input, editing.existing);
                  setEditing(undefined);
                } finally {
                  setSaving(false);
                }
              }}
              onClose={() => setEditing(undefined)}
            />
          </Modal>,
          document.body,
        )}
      {deleting &&
        createPortal(
          <Modal
            title={t("deleteProvider")}
            closeDisabled={action.pending}
            closeLabel={t("close")}
            onClose={() => {
              if (!action.pending) setDeleting(undefined);
            }}
          >
            <p>{t("deleteProviderConfirm", { name: deleting.name })}</p>
            <ErrorNotice error={action.error} />
            <div className="provider-row-actions">
              <ActionButton
                className="provider-delete"
                disabled={action.pending}
                onClick={() =>
                  void action.run(async () => {
                    await remove(deleting.id);
                    setDeleting(undefined);
                  })
                }
              >
                {t("delete")}
              </ActionButton>
              <ActionButton disabled={action.pending} onClick={() => setDeleting(undefined)}>
                {t("cancel")}
              </ActionButton>
            </div>
          </Modal>,
          document.body,
        )}
    </div>
  );
};
