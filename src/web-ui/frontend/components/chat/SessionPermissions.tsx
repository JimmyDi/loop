import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PermissionPreset, SessionSnapshot } from "../../../shared/protocol";
import { useComposerMenu } from "../../hooks/useComposerMenu";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { FullAccessDialog } from "./FullAccessDialog";
import { PermissionIcon } from "./PermissionIcon";
import "./SessionPermissions.css";

const presets: PermissionPreset[] = ["read-only", "workspace-write", "danger-full-access"];

export const SessionPermissions = ({
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
  select(preset: PermissionPreset): Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const menu = useComposerMenu(disabled, pending);
  const id = useId();
  const [confirmFull, setConfirmFull] = useState(false);
  const preset = snapshot.state.permissionPreset;
  if (!preset) return null;

  const choose = async (next: PermissionPreset) => {
    if (disabled || pending) return;
    if (next === preset) return menu.close();
    if (next === "danger-full-access") {
      menu.close();
      setConfirmFull(true);
    } else if (await select(next)) menu.close();
  };

  return (
    <>
      <div
        className="session-permissions"
        ref={menu.root}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
            menu.close(false);
        }}
      >
        <ActionButton
          ref={menu.trigger}
          className="permission-trigger ghost"
          data-full-access={preset === "danger-full-access"}
          disabled={disabled || pending}
          aria-label={t("permissions.label") + ": " + t(`permissions.${preset}`)}
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
          <PermissionIcon preset={preset} />
          <span>{t(`permissions.${preset}`)}</span>
        </ActionButton>
        {menu.page && (
          <div
            id={id}
            ref={menu.panel}
            className="permission-popover"
            onKeyDown={menu.navigate}
            aria-busy={pending}
          >
            <p className="permission-menu-heading">{t("permissions.menuHeading")}</p>
            <div role="menu" aria-label={t("permissions.label")}>
              {presets.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  tabIndex={-1}
                  aria-checked={value === preset}
                  disabled={disabled || pending}
                  data-full-access={value === "danger-full-access"}
                  onClick={() => void choose(value)}
                >
                  <PermissionIcon preset={value} />
                  <span className="permission-option-copy">
                    <span>{t(`permissions.${value}`)}</span>
                    <small>{t(`permissions.${value}Hint`)}</small>
                  </span>
                  <span className="permission-check" aria-hidden="true">
                    {value === preset ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
            <ErrorNotice error={error} />
          </div>
        )}
      </div>
      {confirmFull && (
        <FullAccessDialog
          pending={pending}
          disabled={disabled}
          error={error}
          onClose={() => setConfirmFull(false)}
          confirm={async () => {
            if (!disabled && !pending && (await select("danger-full-access")))
              setConfirmFull(false);
          }}
        />
      )}
    </>
  );
};
