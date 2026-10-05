import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PermissionPreset } from "../../../shared/protocol";
import { useComposerMenu } from "../../hooks/useComposerMenu";
import { ActionButton } from "../ui/ActionButton";
import { FullAccessDialog } from "../chat/FullAccessDialog";
import { PermissionIcon } from "../chat/PermissionIcon";
import "./DefaultPermissionSelect.css";

const presets: PermissionPreset[] = ["read-only", "workspace-write", "danger-full-access"];

export const DefaultPermissionSelect = ({
  value,
  disabled,
  pending,
  error,
  select,
  labelId,
  descriptionId,
}: {
  value?: PermissionPreset;
  disabled: boolean;
  pending: boolean;
  error?: unknown;
  select(value: PermissionPreset): Promise<boolean>;
  labelId: string;
  descriptionId: string;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const menu = useComposerMenu(disabled, pending);
  const [confirming, setConfirming] = useState(false);
  const choose = async (preset: PermissionPreset) => {
    if (disabled || pending) return;
    if (preset === value) return menu.close();
    if (preset === "danger-full-access") {
      menu.close();
      setConfirming(true);
    } else if (await select(preset)) menu.close();
  };
  return (
    <>
      <div
        className="default-permission-select"
        ref={menu.root}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
            menu.close(false);
        }}
      >
        <ActionButton
          ref={menu.trigger}
          className="default-permission-trigger ghost"
          data-full-access={value === "danger-full-access"}
          disabled={disabled || pending}
          aria-haspopup="menu"
          aria-expanded={!!menu.page}
          aria-controls={menu.page ? id : undefined}
          aria-labelledby={labelId + " " + id + "-value"}
          aria-describedby={descriptionId}
          onClick={() => (menu.page ? menu.close() : menu.setPage("main"))}
          onKeyDown={(event) => {
            if (["ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              menu.setPage("main");
            }
          }}
        >
          {value && <PermissionIcon preset={value} />}
          <span id={id + "-value"}>{value ? t(`permissions.${value}`) : t("loading")}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </ActionButton>
        {menu.page && (
          <div
            id={id}
            className="default-permission-options"
            ref={menu.panel}
            role="menu"
            aria-labelledby={labelId}
            onKeyDown={menu.navigate}
          >
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                role="menuitemradio"
                aria-checked={preset === value}
                aria-labelledby={id + "-" + preset + "-label"}
                aria-describedby={id + "-" + preset + "-hint"}
                disabled={disabled || pending}
                data-full-access={preset === "danger-full-access"}
                tabIndex={-1}
                onClick={() => void choose(preset)}
              >
                <PermissionIcon preset={preset} />
                <span className="default-permission-copy">
                  <span id={id + "-" + preset + "-label"}>{t(`permissions.${preset}`)}</span>
                  <small id={id + "-" + preset + "-hint"}>{t(`permissions.${preset}Hint`)}</small>
                </span>
                <span className="default-permission-check" aria-hidden="true">
                  {preset === value ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {confirming && (
        <FullAccessDialog
          scope="default"
          pending={pending}
          disabled={disabled}
          error={error}
          onClose={() => setConfirming(false)}
          confirm={async () => {
            if (!disabled && !pending && (await select("danger-full-access"))) setConfirming(false);
          }}
        />
      )}
    </>
  );
};
