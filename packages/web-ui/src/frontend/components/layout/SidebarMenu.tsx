import { lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { useComposerMenu } from "../../hooks/useComposerMenu";
import { useAccount } from "../../state/account-store";
import { command } from "../../lib/api";
import { isRemoteClient } from "../../lib/remote-session";
import { feedbackIssueUrl } from "../../lib/feedback-issue";
import { ActionButton } from "../ui/ActionButton";
import { SettingsIcon } from "../ui/SettingsIcon";
import "./SidebarMenu.css";

const AccountSettings = lazy(() =>
  import("../accounts/AccountSettings").then((value) => ({ default: value.AccountSettings })),
);

export const SidebarMenu = ({ onOpenSettings }: { onOpenSettings(): void }) => {
  const { t } = useTranslation();
  const user = useAccount((state) => state.user);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const menu = useComposerMenu(false, false);
  const id = useId();

  return (
    <div
      className="sidebar-menu"
      ref={menu.root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          menu.close(false);
      }}
    >
      <ActionButton
        ref={menu.trigger}
        className="sidebar-menu-trigger ghost"
        aria-label={t("appMenu")}
        aria-haspopup="menu"
        aria-expanded={!!menu.page}
        aria-controls={menu.page ? id : undefined}
        onClick={() => (menu.page ? menu.close() : menu.open("main"))}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            menu.open("main");
          } else if (menu.page) {
            menu.navigate(event);
          }
        }}
      >
        {t("appMenu")}
      </ActionButton>
      {menu.page && (
        <div
          id={id}
          ref={menu.panel}
          className="sidebar-menu-panel"
          role="menu"
          aria-label={t("appMenu")}
          onKeyDown={menu.navigate}
        >
          {!isRemoteClient() && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-haspopup="dialog"
              onClick={() => {
                menu.close();
                onOpenSettings();
              }}
            >
              <SettingsIcon />
              {t("settings")}
            </button>
          )}
          {user && !isRemoteClient() && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                menu.close();
                setAccountsOpen(true);
              }}
            >
              {t("accounts.settings")}
            </button>
          )}
          {user && !isRemoteClient() && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                void command("/auth/logout")
                  .then(() => location.reload())
                  .catch(() => setLogoutFailed(true));
              }}
            >
              {t("accounts.logout")} ({user.username})
            </button>
          )}
          <a
            role="menuitem"
            tabIndex={-1}
            href={feedbackIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => menu.close()}
          >
            <svg viewBox="-2 -2 28 28" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
              <path d="M22 2 11 13" />
            </svg>
            {t("feedback")}
          </a>
        </div>
      )}
      {logoutFailed && <p role="alert">{t("accounts.failed")}</p>}
      {accountsOpen && (
        <Suspense fallback={null}>
          <AccountSettings onClose={() => setAccountsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};
