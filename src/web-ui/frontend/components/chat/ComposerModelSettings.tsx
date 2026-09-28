import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { ModelSelection, SessionSnapshot } from "../../../shared/protocol";
import { useModels } from "../../hooks/useModels";
import { useComposerMenu } from "../../hooks/useComposerMenu";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ModelChoices } from "./ModelChoices";
import "./ComposerModelSettings.css";

export const ComposerModelSettings = ({
  snapshot,
  disabled,
  pending,
  error,
  select,
}: {
  snapshot: SessionSnapshot;
  disabled: boolean;
  pending: boolean;
  error?: unknown;
  select(choice: ModelSelection): Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const query = useModels();
  const menu = useComposerMenu(disabled, pending);
  const id = useId();
  const current =
    query.data?.find(
      (model) => model.provider === snapshot.model.provider && model.id === snapshot.model.id,
    ) ?? snapshot.model;
  const efforts = current.efforts ?? [];
  const effort = snapshot.effort ?? "default";
  const choose = async (choice: ModelSelection) => {
    if (await select(choice)) menu.close();
  };
  return (
    <div
      className="composer-model-settings"
      ref={menu.root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          menu.close(false);
      }}
    >
      <ActionButton
        ref={menu.trigger}
        className="composer-model-trigger ghost"
        disabled={disabled || pending}
        aria-label={
          t("modelConfiguration") +
          ": " +
          current.name +
          (efforts.length ? " · " + t("efforts." + effort) : "")
        }
        aria-haspopup="menu"
        aria-expanded={!!menu.page}
        aria-controls={menu.page ? id : undefined}
        onClick={() => (menu.page ? menu.close() : menu.setPage("main"))}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            menu.setPage("main");
          }
        }}
      >
        <span className="composer-model-name">{current.name}</span>
        {efforts.length > 0 && (
          <span className="composer-model-effort">{t("efforts." + effort)}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={menu.page ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </ActionButton>
      {menu.page && (
        <div
          id={id}
          className="composer-model-popover"
          ref={menu.panel}
          role="group"
          aria-label={t("modelConfiguration")}
          onKeyDown={menu.navigate}
          aria-busy={pending}
        >
          {menu.page === "main" ? (
            <div role="menu" aria-label={t("modelConfiguration")}>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-haspopup="menu"
                onClick={() => menu.setPage("model")}
              >
                <span>{t("model")}</span>
                <span className="model-menu-value">{current.name}</span>
                <span aria-hidden="true">›</span>
              </button>
              {efforts.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-haspopup="menu"
                  onClick={() => menu.setPage("effort")}
                >
                  <span>{t("effort")}</span>
                  <span className="model-menu-value">{t("efforts." + effort)}</span>
                  <span aria-hidden="true">›</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="model-menu-back"
                onClick={() => menu.setPage("main")}
                aria-label={t("backToModelSettings")}
              >
                <span aria-hidden="true">‹</span>
                {t(menu.page === "model" ? "model" : "effort")}
              </button>
              {menu.page === "model" ? (
                <>
                  {query.isPending && <p role="status">{t("loading")}</p>}
                  <ErrorNotice error={query.error} />
                  {query.isError && (
                    <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
                  )}
                  {query.isSuccess && (
                    <ModelChoices
                      models={query.data}
                      current={current}
                      disabled={pending || disabled}
                      select={(model) =>
                        void choose({
                          provider: model.provider,
                          id: model.id,
                          effort: model.efforts?.includes(effort) ? effort : "default",
                        })
                      }
                    />
                  )}
                </>
              ) : (
                <div role="menu" aria-label={t("effort")}>
                  {efforts.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      tabIndex={-1}
                      aria-checked={value === effort}
                      disabled={pending || disabled}
                      onClick={() =>
                        void choose({ provider: current.provider, id: current.id, effort: value })
                      }
                    >
                      <span>{t("efforts." + value)}</span>
                      {value === effort && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <ErrorNotice error={error} />
        </div>
      )}
    </div>
  );
};
